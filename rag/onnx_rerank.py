"""
Cross-encoder reranker run with onnxruntime + tokenizers (no PyTorch).

Replaces llama_index's SentenceTransformerRerank, which pulled in
sentence-transformers + torch (hundreds of MB). Model: the int8 ONNX export
of cross-encoder/ms-marco-MiniLM-L-6-v2 (23 MB), stored in rag/models/ so
nothing is downloaded at run time (the Vercel filesystem is read-only).
Score = logits[:, 0] for each (query, passage) pair: higher = more relevant.
"""
import json
import threading
from pathlib import Path
from typing import List, Optional

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
from llama_index.core.postprocessor.types import BaseNodePostprocessor
from llama_index.core.schema import NodeWithScore, QueryBundle

MODEL_DIR = Path(__file__).parent / "models" / "ms-marco-MiniLM-L-6-v2"
MODEL_FILE = "model_quantized.onnx"

_lock = threading.Lock()
_model = None


def _load():
    global _model
    with _lock:
        if _model is None:
            cfg = json.loads((MODEL_DIR / "tokenizer_config.json").read_text())
            max_len = cfg.get("model_max_length", 512)
            if not isinstance(max_len, int) or max_len > 100000:
                max_len = 512
            tok = Tokenizer.from_file(str(MODEL_DIR / "tokenizer.json"))
            tok.enable_truncation(max_length=max_len)
            pad_token = cfg.get("pad_token") or "[PAD]"
            tok.enable_padding(pad_id=tok.token_to_id(pad_token) or 0, pad_token=pad_token)
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 1
            opts.inter_op_num_threads = 1
            sess = ort.InferenceSession(str(MODEL_DIR / MODEL_FILE), sess_options=opts,
                                        providers=["CPUExecutionProvider"])
            _model = (tok, sess)
    return _model


def score(query: str, passages: List[str], batch_size: int = 16) -> List[float]:
    tok, sess = _load()
    names = {i.name for i in sess.get_inputs()}
    out = []
    for i in range(0, len(passages), batch_size):
        enc = tok.encode_batch([(query, p) for p in passages[i:i + batch_size]])
        feed = {"input_ids": np.array([e.ids for e in enc], dtype=np.int64)}
        if "attention_mask" in names:
            feed["attention_mask"] = np.array([e.attention_mask for e in enc], dtype=np.int64)
        if "token_type_ids" in names:
            feed["token_type_ids"] = np.array([e.type_ids for e in enc], dtype=np.int64)
        out.extend(sess.run(None, feed)[0][:, 0].tolist())
    return out


class OnnxRerank(BaseNodePostprocessor):
    """Drop-in replacement for SentenceTransformerRerank(top_n=...)."""
    top_n: int = 4
    min_score: Optional[float] = None   # drop passages below this score (None = keep all)

    @classmethod
    def class_name(cls) -> str:
        return "OnnxRerank"

    def _postprocess_nodes(self, nodes: List[NodeWithScore],
                           query_bundle: Optional[QueryBundle] = None) -> List[NodeWithScore]:
        if query_bundle is None or not nodes:
            return nodes
        scores = score(query_bundle.query_str, [n.node.get_content() for n in nodes])
        for n, s in zip(nodes, scores):
            n.score = float(s)
        ranked = sorted(nodes, key=lambda n: n.score, reverse=True)
        if self.min_score is not None:
            ranked = [n for n in ranked if n.score >= self.min_score]
        return ranked[: self.top_n]
