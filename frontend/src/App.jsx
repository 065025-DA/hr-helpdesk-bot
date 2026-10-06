import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  CreditCard,
  FileText,
  History,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Send,
  Shield,
  Sparkles,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import "./App.css";

// Edith is now the HR-only helpdesk, so the four departments became three HR "help topics".
const departments = [
  {
    id: "policy",
    name: "Policy questions",
    short: "Policy",
    description:
      "Leave, attendance, pay, benefits, conduct, performance and exit rules, answered from the HR policy documents with the source shown.",
    icon: BookOpen,
    color: "#F2A11B",
    soft: "#FFF5E5",
    questions: [
      "How many casual leaves do I get in a year?",
      "How does Earned Leave work?",
      "What is the notice period?",
    ],
  },
  {
    id: "leave",
    name: "My leave balance",
    short: "Leave",
    description:
      "Sign in with your employee ID to see your own Casual, Sick and Earned Leave, comp-off and floating holidays.",
    icon: CalendarDays,
    color: "#119B8B",
    soft: "#EAF9F6",
    questions: [
      "What is my leave balance?",
      "How many casual leaves do I have left?",
      "Can I take Earned Leave next week?",
    ],
  },
  {
    id: "tickets",
    name: "HR tickets",
    short: "Tickets",
    description:
      "If Edith can't answer, raise an HR ticket in one click and get a ticket number and the expected response time.",
    icon: Ticket,
    color: "#2D6CDF",
    soft: "#EDF4FF",
    questions: [
      "My salary has not been credited",
      "Does the company give a car loan?",
      "I need an employment verification letter",
    ],
  },
];

const hrDocuments = [
  { code: "HR-01", title: "Employee Handbook", file: "HR-01_Employee_Handbook.pdf" },
  { code: "HR-02", title: "Leave Policy", file: "HR-02_Leave_Policy.pdf" },
  { code: "HR-03", title: "Attendance, Working Hours and Hybrid Work", file: "HR-03_Attendance_Working_Hours_and_Hybrid_Work.pdf" },
  { code: "HR-04", title: "Code of Conduct and Ethics", file: "HR-04_Code_of_Conduct_and_Ethics.pdf" },
  { code: "HR-05", title: "POSH Policy", file: "HR-05_POSH_Policy.pdf" },
  { code: "HR-06", title: "Compensation, Payroll and Benefits", file: "HR-06_Compensation_Payroll_and_Benefits.pdf" },
  { code: "HR-07", title: "Recruitment, Onboarding and Probation", file: "HR-07_Recruitment_Onboarding_and_Probation.pdf" },
  { code: "HR-08", title: "Performance Management and Promotion", file: "HR-08_Performance_Management_and_Promotion.pdf" },
  { code: "HR-09", title: "Learning and Development", file: "HR-09_Learning_and_Development.pdf" },
  { code: "HR-10", title: "Grievance and Disciplinary Procedure", file: "HR-10_Grievance_and_Disciplinary_Procedure.pdf" },
  { code: "HR-11", title: "Separation and Exit Policy", file: "HR-11_Separation_and_Exit_Policy.pdf" },
  { code: "HR-12", title: "HR Helpdesk and Ticket Procedure", file: "HR-12_HR_Helpdesk_and_Ticket_Procedure.pdf" },
  { code: "HR-13", title: "HR Quick FAQ", file: "HR-13_HR_Quick_FAQ.pdf" },
];

function EdithMark({ small = false }) {
  return (
    <div className={`edith-mark ${small ? "small" : ""}`}>
      <Sparkles size={small ? 17 : 22} strokeWidth={2.1} />
    </div>
  );
}

function DepartmentIcon({ department, size = 21 }) {
  const Icon = department.icon;

  return (
    <Icon
      size={size}
      strokeWidth={1.9}
      style={{ color: department.color }}
    />
  );
}

function SourceIcon({ type = "pdf" }) {
  if (type === "excel") return <CreditCard size={18} />;
  return <FileText size={18} />;
}

function App() {
  const [page, setPage] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDepartment, setSelectedDepartment] =
    useState("All topics");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [citation, setCitation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedDept, setExpandedDept] = useState(null);
  const [history, setHistory] = useState([]);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [employee, setEmployee] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("edith-employee"));
    } catch {
      return null;
    }
  });
  const [showSignIn, setShowSignIn] = useState(false);

  // The question the user asked before signing in, so it can be answered right after sign-in.
  const [pendingQuestion, setPendingQuestion] = useState(null);

  const composerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("edith-history");

    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, []);

  async function checkHealth() {
    try {
      const response = await fetch("/health");
      setBackendStatus(response.ok ? "ready" : "error");
    } catch {
      setBackendStatus("offline");
    }
  }

  // Demo sign-in: the employee ID is checked by the backend (/api/hr/signin).
  // A real company would use single sign-on instead.
  async function signIn(rawId) {
    const id = String(rawId || "").trim().toUpperCase();

    if (!id) return "Please enter your employee ID.";

    try {
      const response = await fetch("/api/hr/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: id }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return data.detail || "Could not sign in. Please check your ID.";
      }

      const emp = {
        id: data.employee_id,
        name: data.name,
        department: data.department,
      };

      setEmployee(emp);
      sessionStorage.setItem("edith-employee", JSON.stringify(emp));
      setShowSignIn(false);

      // Tell the user clearly that sign-in worked and that they can ask now.
      const firstName = String(emp.name || "").split(" ")[0] || "there";
      const pending = pendingQuestion;

      setPendingQuestion(null);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          text: pending
            ? `Hello ${firstName}! You're now signed in as ${emp.id}. I'll answer your earlier question now.`
            : `Hello ${firstName}! You're now signed in as ${emp.id}. Please go ahead and ask your question. You can ask for your leave balance, ask about an HR policy, or raise an HR ticket.`,
          sources: [],
          grounded: true,
          ticketOffer: null,
          intent: "greeting",
        },
      ]);

      // Answer the question that was asked before sign-in (no need to type it again).
      if (pending) {
        askEdith(pending, { employeeId: emp.id, skipUserMessage: true });
      }

      return null;
    } catch {
      return "Cannot reach the server. Is the backend running?";
    }
  }

  function signOut() {
    setEmployee(null);
    sessionStorage.removeItem("edith-employee");
    setPendingQuestion(null);
    setMessages([]);
    setCitation(null);
  }

  function goHome() {
    setPage("home");
    setMobileMenu(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openAssistant(
    question = "",
    department = "All topics"
  ) {
    setPage("assistant");
    setSelectedDepartment(department);
    setMobileMenu(false);

    if (question) {
      setInput(question);

      setTimeout(() => {
        composerRef.current?.focus();
      }, 150);
    }
  }

  function newConversation() {
    setMessages([]);
    setInput("");
    setCitation(null);
  }

  function scrollToSection(id) {
    setMobileMenu(false);

    if (page !== "home") {
      setPage("home");

      setTimeout(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);

      return;
    }

    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function askEdith(question = input, options = {}) {
    const query = question.trim();

    if (!query || loading) return;

    // options.skipUserMessage: re-asking the question the user already typed (after sign-in)
    // options.employeeId: use this ID right away (the employee state has not updated yet)
    const askAs = options.employeeId || employee?.id || null;

    if (!options.skipUserMessage) {
      const userMessage = {
        id: Date.now(),
        role: "user",
        text: query,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
    }

    setLoading(true);
    setCitation(null);

    try {
      // last few turns so follow-up questions work ("and for managers?")
      const turns = messages
        .filter((m) => !m.error)
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: String(m.text || "").slice(0, 600),
        }));

      const response = await fetch("/api/hr/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: query,
          employee_id: askAs,
          history: turns,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();

      const answer =
        data.answer ||
        data.response ||
        data.result ||
        data.message ||
        "I couldn't find enough information in the available company documents.";

      const sources =
        data.sources ||
        data.citations ||
        data.documents ||
        data.context ||
        [];

      const normalizedSources = normalizeSources(sources);

      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        text: answer,
        sources: normalizedSources,
        grounded:
          data.intent && data.intent !== "policy"
            ? true
            : normalizedSources.length > 0 && !data.needs_human,
        ticketOffer: data.ticket_offer || null,
        intent: data.intent || "policy",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.intent === "need_signin") {
        setPendingQuestion(query);
        setShowSignIn(true);
      }

      if (!options.skipUserMessage) {
        const historyItem = {
          id: Date.now(),
          query,
          department: selectedDepartment,
        };

        const newHistory = [historyItem, ...history].slice(0, 8);

        setHistory(newHistory);

        localStorage.setItem(
          "edith-history",
          JSON.stringify(newHistory)
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          error: true,
          text:
            "I couldn't connect to the knowledge service right now. Please check that the FastAPI backend, Qdrant and Ollama service are running.",
          sources: [],
          grounded: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function normalizeSources(rawSources) {
    if (!Array.isArray(rawSources)) return [];

    const seen = new Set();
    const result = [];

    rawSources.forEach((source) => {
      const rawText = String(
        source.text ||
          source.content ||
          source.chunk ||
          source.context ||
          ""
      );

      // Each chunk starts with "HR-02 Leave Policy | Section: 7. Earned Leave (EL)"
      const header = rawText.match(/^(.+?) \| Section: (.+?)\n/);

      const name = header
        ? header[1]
        : source.filename ||
          source.file_name ||
          source.source_file ||
          source.document ||
          source.title ||
          source.source ||
          `Source ${result.length + 1}`;

      const section = header ? header[2] : null;
      const key = `${name}|${section}`;

      if (seen.has(key)) return;
      seen.add(key);

      result.push({
        id: result.length + 1,
        name,
        section,
        page:
          source.page ||
          source.page_number ||
          source.metadata?.page ||
          source.metadata?.page_number ||
          null,
        text: header ? rawText.slice(header[0].length) : rawText,
        relevance:
          source.score ||
          source.similarity ||
          source.relevance ||
          null,
        type:
          source.type ||
          (String(source.filename || source.source_file || "")
            .toLowerCase()
            .includes("xlsx")
            ? "excel"
            : "pdf"),
      });
    });

    return result;
  }

  function copyAnswer(text) {
    navigator.clipboard?.writeText(text);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askEdith();
    }
  }

  const activeDepartment = useMemo(
    () =>
      departments.find(
        (department) => department.id === selectedDepartment
      ) || departments[0],
    [selectedDepartment]
  );

  return (
    <div className="app">
      {page === "home" ? (
        <LandingPage
          onAsk={openAssistant}
          onScroll={scrollToSection}
          mobileMenu={mobileMenu}
          setMobileMenu={setMobileMenu}
        />
      ) : (
        <AssistantPage
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          activeDepartment={activeDepartment}
          openAssistant={openAssistant}
          goHome={goHome}
          newConversation={newConversation}
          history={history}
          expandedDept={expandedDept}
          setExpandedDept={setExpandedDept}
          backendStatus={backendStatus}
          messages={messages}
          loading={loading}
          input={input}
          setInput={setInput}
          askEdith={askEdith}
          handleKeyDown={handleKeyDown}
          composerRef={composerRef}
          citation={citation}
          setCitation={setCitation}
          copied={copied}
          copyAnswer={copyAnswer}
          employee={employee}
          showSignIn={showSignIn}
          setShowSignIn={(open) => {
            setShowSignIn(open);
            if (!open) setPendingQuestion(null);
          }}
          signIn={signIn}
          signOut={signOut}
        />
      )}
    </div>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

function LandingPage({
  onAsk,
  onScroll,
  mobileMenu,
  setMobileMenu,
}) {
  return (
    <div className="landing">
      <header className="site-nav">
        <div
          className="nav-brand"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          <EdithMark />

          <div>
            <div className="brand-name">Northbridge</div>
            <div className="brand-subtitle">DYNAMICS</div>
          </div>
        </div>

        <nav className={`nav-links ${mobileMenu ? "open" : ""}`}>
          <button onClick={() => onScroll("how-it-works")}>
            How it works
          </button>

          <button onClick={() => onScroll("departments")}>
            What Edith does
          </button>

          <button onClick={() => onScroll("sources")}>
            Sources
          </button>

          <button onClick={() => onAsk()}>
            Edith
          </button>
        </nav>

        <div className="nav-actions">
          <button
            className="nav-explore"
            onClick={() => onScroll("departments")}
          >
            Explore
          </button>

          <button
            className="primary-cta"
            onClick={() => onAsk()}
          >
            Ask Edith
            <ArrowUpRight size={19} />
          </button>
        </div>

        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          {mobileMenu ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        {/* HERO */}

        <section className="hero">
          <div className="hero-decoration purple-orb"></div>
          <div className="hero-decoration yellow-orb"></div>
          <div className="hero-grid"></div>

          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot"></span>
              NORTHBRIDGE HR HELPDESK
            </div>

            <h1>
              Find what you need.
              <br />

              <span className="hero-gradient-text">
                Understand what matters.
              </span>

              <br />

              Edith makes it simple.
            </h1>

            <p className="hero-description">
              Edith is the Northbridge HR helpdesk. Ask about leave,
              attendance, pay and benefits, check your own leave
              balance, or raise an HR ticket when you need a person.
            </p>

            <div className="hero-actions">
              <button
                className="primary-cta large"
                onClick={() => onAsk()}
              >
                Ask Edith
                <ArrowRight size={20} />
              </button>

              <button
                className="text-cta"
                onClick={() => onScroll("how-it-works")}
              >
                Explore how it works
                <ArrowDown size={18} />
              </button>
            </div>

            <div className="hero-points">
              <span>
                <Check size={17} />
                Source-backed
              </span>

              <span>
                <Check size={17} />
                Leave balance and tickets
              </span>

            </div>
          </div>

          <div className="hero-product">
            <div className="hero-product-glow"></div>

            <div className="browser-window">
              <div className="browser-top">
                <div className="browser-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <div className="browser-address">
                  northbridge / edith
                </div>

                <div className="ready-indicator">
                  <span></span>
                  Ready
                </div>
              </div>

              <div className="mock-product">
                <div className="mock-sidebar">
                  <EdithMark small />
                  <MessageSquare />
                  <FileText />
                  <Search />
                </div>

                <div className="mock-chat">
                  <div className="mock-label">
                    NORTHBRIDGE HR HELPDESK
                  </div>

                  <div className="mock-chat-title">
                    Ask Edith
                    <Sparkles size={20} />
                  </div>

                  <div className="mock-user-question">
                    How many casual leaves do I get?
                  </div>

                  <div className="mock-answer">
                    <div className="mock-answer-heading">
                      <EdithMark small />
                      <strong>Edith</strong>
                    </div>

                    <p>
                      I found relevant information in the Human
                      Resources policy documents.
                    </p>

                    <div className="mock-source">
                      <FileText size={16} />
                      HR-02 Leave Policy · Section 5
                      <ArrowUpRight size={15} />
                    </div>
                  </div>

                  <div className="mock-input">
                    <span>Ask about a company policy...</span>

                    <div className="mock-send">
                      <Send size={17} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MOVED LOWER — DOES NOT COVER ASK EDITH */}

            <div className="floating-search">
              <div className="floating-icon purple">
                <Search size={20} />
              </div>

              <div>
                <strong>Searching policies</strong>
                <span>Qdrant knowledge base</span>
              </div>

              <div className="search-scan"></div>
            </div>

            <div className="floating-source">
              <div className="floating-check">
                <Check size={18} />
              </div>

              <div>
                <strong>Source found</strong>
                <span>Evidence attached</span>
              </div>
            </div>

            <div className="hero-particle particle-one"></div>
            <div className="hero-particle particle-two"></div>
            <div className="hero-particle particle-three"></div>
          </div>
        </section>

        {/* HOW IT WORKS */}

        <section
          id="how-it-works"
          className="how-section"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow dark">
                <span className="eyebrow-dot"></span>
                HOW EDITH WORKS
              </div>

              <h2>
                From company documents
                <br />
                <span>to useful answers.</span>
              </h2>
            </div>
          </div>

          <div className="architecture">
            <ArchitectureStep
              number="01"
              icon={<FileText />}
              title="Company documents"
              text="Policies, procedures and internal knowledge are collected."
            />

            <div className="architecture-arrow">
              <ArrowRight />
            </div>

            <ArchitectureStep
              number="02"
              icon={<BookOpen />}
              title="Knowledge base"
              text="Documents are converted into searchable knowledge chunks."
            />

            <div className="architecture-arrow">
              <ArrowRight />
            </div>

            <ArchitectureStep
              number="03"
              icon={<Search />}
              title="Relevant evidence"
              text="Edith retrieves the most relevant information for each question."
            />

            <div className="architecture-arrow">
              <ArrowRight />
            </div>

            <ArchitectureStep
              number="04"
              icon={<Sparkles />}
              title="Useful answer"
              text="The LLM explains the answer and shows where it came from."
            />
          </div>
        </section>

        {/* DEPARTMENTS */}

        <section
          id="departments"
          className="departments-section"
        >
          <div className="department-heading">
            <div>
              <div className="eyebrow dark">
                <span className="eyebrow-dot"></span>
                EXPLORE KNOWLEDGE
              </div>

              <h2>
                Four ways
                <br />
                <span>Edith helps.</span>
              </h2>
            </div>

            <p>
              Edith answers policy questions, shows your own leave
              balance, raises an HR ticket when the documents do not
              have the answer, and lets you read the full HR documents.
            </p>
          </div>

          <div className="department-grid">
            {departments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                                onAsk={onAsk}
              />
            ))}

            <DocumentsCard />
          </div>
        </section>

        {/* EVIDENCE */}

        <section
          id="sources"
          className="evidence-section"
        >
          <div className="evidence-glow evidence-glow-one"></div>
          <div className="evidence-glow evidence-glow-two"></div>

          {/* NEW VISUAL — FILLS THE EMPTY SPACE */}

          <EvidenceVisual />

          <div className="evidence-copy">
            <div className="eyebrow evidence">
              <span className="eyebrow-dot"></span>
              EVIDENCE FIRST
            </div>

            <h2>
              An answer is more useful
              <br />
              when you{" "}
              <span className="evidence-highlight">
                can see why.
              </span>
            </h2>

            <p>
              Edith shows the policy evidence behind an answer.
              Employees can open a citation, inspect the source and
              understand where the response came from.
            </p>

            <ul>
              <li>
                <Check size={18} />
                Relevant policy passage
              </li>

              <li>
                <Check size={18} />
                Document and section reference
              </li>

              <li>
                <Check size={18} />
                Evidence beside the answer
              </li>
            </ul>
          </div>
        </section>

        {/* FINAL CTA */}

        <section className="final-cta-section">
          <div className="yellow-sparkle">
            <Sparkles size={30} />
          </div>

          <div className="eyebrow dark">
            <span className="eyebrow-dot"></span>
            NORTHBRIDGE DYNAMICS
          </div>

          <h2>
            Your questions deserve
            <br />
            <span>clear answers.</span>
          </h2>

          <p>
            Ask Edith about company policies, procedures and
            internal knowledge.
          </p>

          <button
            className="primary-cta large"
            onClick={() => onAsk()}
          >
            Ask Edith
            <ArrowUpRight size={20} />
          </button>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <EdithMark small />

          <div>
            <strong>Northbridge Dynamics</strong>
            <span>Knowledge made accessible.</span>
          </div>
        </div>

        <div className="footer-links">
          <button onClick={() => onScroll("how-it-works")}>
            How it works
          </button>

          <button onClick={() => onScroll("departments")}>
            What Edith does
          </button>

          <button onClick={() => onScroll("sources")}>
            Sources
          </button>

          <button onClick={() => onAsk()}>
            Ask Edith
          </button>
        </div>

        <div className="footer-tech">
          FastAPI · Qdrant · Ollama
        </div>
      </footer>
    </div>
  );
}

/* =========================================================
   NEW EVIDENCE VISUAL
========================================================= */

function EvidenceVisual() {
  return (
    <div className="evidence-visual">
      <div className="evidence-visual-grid"></div>

      <div className="evidence-orbit orbit-one"></div>
      <div className="evidence-orbit orbit-two"></div>

      <div className="evidence-document document-one">
        <div className="mini-file-icon purple">
          <FileText size={18} />
        </div>

        <div>
          <strong>HR-02 Leave Policy</strong>
          <span>Section 7</span>
        </div>

        <Check size={15} />
      </div>

      <div className="evidence-document document-two">
        <div className="mini-file-icon yellow">
          <BookOpen size={18} />
        </div>

        <div>
          <strong>HR-01 Employee Handbook</strong>
          <span>Section 10</span>
        </div>

        <ArrowUpRight size={15} />
      </div>

      <div className="evidence-document document-three">
        <div className="mini-file-icon black">
          <Shield size={18} />
        </div>

        <div>
          <strong>Policy evidence</strong>
          <span>Retrieved passage</span>
        </div>
      </div>

      <div className="evidence-connection connection-one"></div>
      <div className="evidence-connection connection-two"></div>
      <div className="evidence-connection connection-three"></div>

      <div className="evidence-main-card">
        <div className="evidence-main-top">
          <div className="evidence-edith">
            <EdithMark small />

            <div>
              <strong>Edith</strong>
              <span>Evidence found</span>
            </div>
          </div>

          <div className="evidence-confidence">
            <Check size={13} />
            Verified
          </div>
        </div>

        <div className="evidence-question">
          "How does Earned Leave work?"
        </div>

        <div className="evidence-answer-line">
          Earned Leave builds up at 1.5 days a month and up to
          30 days can be carried forward.
        </div>

        <div className="evidence-citation-row">
          <span className="citation-pill">[1]</span>

          <div>
            <strong>HR-02 Leave Policy</strong>
            <span>Relevant passage · Section 7</span>
          </div>

          <ArrowUpRight size={16} />
        </div>
      </div>

      <div className="evidence-search-node">
        <Search size={18} />
      </div>

      <div className="evidence-pulse pulse-one"></div>
      <div className="evidence-pulse pulse-two"></div>
    </div>
  );
}

/* =========================================================
   DEPARTMENT CARD
========================================================= */

// Fourth card in "Four ways Edith helps": opens the full HR policy documents (PDFs in frontend/public/hr-docs).
function DocumentsCard() {
  return (
    <article
      className="department-card"
      style={{ "--dept-color": "#C2487A", "--dept-soft": "#FDEEF4" }}
    >
      <div className="department-card-glow"></div>

      <div className="department-top">
        <div className="department-icon-wrap">
          <div className="department-icon-ring"></div>
          <FileText size={25} strokeWidth={1.8} />
        </div>

        <span className="department-code">Documents</span>
      </div>

      <div className="department-main">
        <h3>HR documents</h3>

        <p>
          Read the full policy documents that Edith answers from. Each one
          opens as a PDF in a new tab.
        </p>
      </div>

      <div className="department-divider"></div>

      <div className="try-heading">
        <span>READ IN FULL</span>
        <span>{hrDocuments.length} documents</span>
      </div>

      <div className="question-list document-list">
        {hrDocuments.map((doc) => (
          <a
            key={doc.code}
            className="department-question document-link"
            href={`/hr-docs/${doc.file}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="question-number">
              {doc.code.replace("HR-", "")}
            </span>

            <span className="question-text">{doc.title}</span>

            <span className="question-arrow">
              <ArrowUpRight size={16} />
            </span>
          </a>
        ))}
      </div>
    </article>
  );
}

function DepartmentCard({ department, onAsk }) {
  const [hovered, setHovered] = useState(false);
  const Icon = department.icon;

  return (
    <article
      className="department-card"
      style={{
        "--dept-color": department.color,
        "--dept-soft": department.soft,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="department-card-glow"></div>

      <div className="department-top">
        <div className="department-icon-wrap">
          <div className="department-icon-ring"></div>
          <Icon size={25} strokeWidth={1.8} />
        </div>

        <span className="department-code">
          {department.short || department.id}
        </span>
      </div>

      <div className="department-main">
        <h3>{department.name}</h3>

        <p>{department.description}</p>
      </div>

      <div className="department-divider"></div>

      <div className="try-heading">
        <span>TRY ASKING</span>
        <span>3 suggested questions</span>
      </div>

      <div className="question-list">
        {department.questions.map((question, index) => (
          <button
            key={question}
            className="department-question"
            onClick={() =>
              onAsk(question, department.id)
            }
          >
            <span className="question-number">
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="question-text">
              {question}
            </span>

            <span className="question-arrow">
              <ArrowUpRight size={16} />
            </span>
          </button>
        ))}
      </div>

      <div
        className={`department-hover-line ${
          hovered ? "visible" : ""
        }`}
      ></div>
    </article>
  );
}

/* =========================================================
   ARCHITECTURE
========================================================= */

function ArchitectureStep({
  number,
  icon,
  title,
  text,
}) {
  return (
    <div className="architecture-step">
      <div className="architecture-icon">
        {icon}
      </div>

      <span className="architecture-number">
        {number}
      </span>

      <h3>{title}</h3>

      <p>{text}</p>
    </div>
  );
}

/* =========================================================
   ASSISTANT
========================================================= */

function AssistantPage({
  sidebarOpen,
  setSidebarOpen,
  selectedDepartment,
  setSelectedDepartment,
  activeDepartment,
  openAssistant,
  goHome,
  newConversation,
  history,
  expandedDept,
  setExpandedDept,
  backendStatus,
  messages,
  loading,
  input,
  setInput,
  askEdith,
  handleKeyDown,
  composerRef,
  citation,
  setCitation,
  copied,
  copyAnswer,
  employee,
  showSignIn,
  setShowSignIn,
  signIn,
  signOut,
}) {
  return (
    <div className="assistant-page">
      {sidebarOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <aside
        className={`assistant-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div
            className="sidebar-brand-click"
            onClick={goHome}
          >
            <EdithMark />

            <div>
              <strong>Edith</strong>
              <span>HR HELPDESK</span>
            </div>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-content">
          <button
            className="back-link"
            onClick={goHome}
          >
            <ArrowLeft size={15} />
            Back to Northbridge
          </button>

          <button
            className="new-conversation"
            onClick={newConversation}
          >
            <MessageSquare size={19} />
            <span>New conversation</span>
            <span className="shortcut">⌘ K</span>
          </button>

          <div className="sidebar-section">
            <div className="sidebar-section-label">
              WHAT I CAN HELP WITH
            </div>

            <button
              className={`sidebar-department all ${
                selectedDepartment ===
                "All topics"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setSelectedDepartment(
                  "All topics"
                )
              }
            >
              <Zap size={18} />

              <span>All topics</span>

              <ChevronRight
                size={15}
                className="side-arrow"
              />
            </button>

            {departments.map((department) => (
              <div key={department.id}>
                <button
                  className={`sidebar-department ${
                    selectedDepartment ===
                    department.id
                      ? "active"
                      : ""
                  }`}
                  style={{
                    "--side-color":
                      department.color,
                    "--side-soft":
                      department.soft,
                  }}
                  onClick={() => {
                    setSelectedDepartment(
                      department.id
                    );

                    setExpandedDept(
                      expandedDept ===
                        department.id
                        ? null
                        : department.id
                    );
                  }}
                >
                  <DepartmentIcon
                    department={department}
                    size={18}
                  />

                  <span>{department.name}</span>

                  <div className="sidebar-department-right">
                    <span className="status-check">
                      <Check size={11} />
                    </span>

                    <ChevronRight
                      size={14}
                      className={`department-chevron ${
                        expandedDept ===
                        department.id
                          ? "expanded"
                          : ""
                      }`}
                    />
                  </div>
                </button>

                {expandedDept ===
                  department.id && (
                  <div className="sidebar-submenu">
                    <div className="submenu-status">
                      <span className="live-pulse"></span>
                      Knowledge base ready
                    </div>

                    {department.questions.map(
                      (question) => (
                        <button
                          key={question}
                          onClick={() =>
                            openAssistant(
                              question,
                              department.id
                            )
                          }
                        >
                          <span>{question}</span>
                          <ArrowUpRight size={13} />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {history.length > 0 && (
            <div className="sidebar-section history-section">
              <div className="sidebar-section-label">
                RECENT CONVERSATIONS
              </div>

              {history.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  className="history-item"
                  onClick={() =>
                    openAssistant(
                      item.query,
                      item.department
                    )
                  }
                >
                  <History size={15} />
                  <span>{item.query}</span>
                </button>
              ))}
            </div>
          )}

          <div className="sidebar-status">
            <div className="sidebar-section-label">
              SYSTEM STATUS
            </div>

            <div
              className={`status-card ${
                backendStatus === "ready"
                  ? "ready"
                  : backendStatus ===
                    "checking"
                  ? "checking"
                  : "error"
              }`}
            >
              <div className="status-card-heading">
                <span className="status-live-dot"></span>

                <strong>
                  {backendStatus ===
                  "ready"
                    ? "System ready"
                    : backendStatus ===
                      "checking"
                    ? "Checking system"
                    : "System unavailable"}
                </strong>
              </div>

              <span>
                FastAPI · Qdrant · Ollama
              </span>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {employee ? employee.name.charAt(0) : "N"}
          </div>

          <div>
            <strong>
              {employee ? employee.name : "Not signed in"}
            </strong>
            <span>
              {employee
                ? `${employee.id} · ${employee.department}`
                : "Sign in to see your leave balance"}
            </span>
          </div>

          <button
            className="sidebar-user-action"
            onClick={() =>
              employee ? signOut() : setShowSignIn(true)
            }
            title={employee ? "Sign out" : "Sign in"}
            aria-label={employee ? "Sign out" : "Sign in"}
          >
            {employee ? <LogOut size={17} /> : <LogIn size={17} />}
          </button>
        </div>
      </aside>

      <main className="assistant-main">
        <header className="assistant-header">
          <button
            className="mobile-sidebar-trigger"
            onClick={() =>
              setSidebarOpen(true)
            }
          >
            <Menu size={21} />
          </button>

          <div>
            <span>
              NORTHBRIDGE HR HELPDESK
            </span>

            <h1>Ask Edith</h1>
          </div>

          <div className="assistant-header-status">
            <span></span>

            {backendStatus === "ready"
              ? "Ready"
              : "Connecting"}
          </div>
        </header>

        {messages.length === 0 ? (
          <AssistantEmptyState
            selectedDepartment={
              selectedDepartment
            }
            activeDepartment={
              activeDepartment
            }
            openAssistant={
              openAssistant
            }
            input={input}
            setInput={setInput}
            askEdith={askEdith}
            handleKeyDown={
              handleKeyDown
            }
            composerRef={composerRef}
          />
        ) : (
          <ChatConversation
            messages={messages}
            loading={loading}
            setCitation={setCitation}
            copyAnswer={copyAnswer}
            copied={copied}
            employeeId={employee?.id}
          />
        )}

        {messages.length > 0 && (
          <div className="conversation-composer-wrap">
            <Composer
              input={input}
              setInput={setInput}
              askEdith={askEdith}
              handleKeyDown={
                handleKeyDown
              }
              composerRef={composerRef}
              activeDepartment={
                activeDepartment
              }
              selectedDepartment={
                selectedDepartment
              }
              loading={loading}
            />
          </div>
        )}
      </main>

      {showSignIn && (
        <SignInModal
          onSignIn={signIn}
          onClose={() => setShowSignIn(false)}
        />
      )}

      {citation && (
        <CitationPanel
          citation={citation}
          onClose={() =>
            setCitation(null)
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   EMPTY ASSISTANT
========================================================= */

function AssistantEmptyState({
  selectedDepartment,
  activeDepartment,
  openAssistant,
  input,
  setInput,
  askEdith,
  handleKeyDown,
  composerRef,
}) {
  const suggestions =
    selectedDepartment ===
    "All topics"
      ? departments.map(
          (department) => ({
            department,
            question:
              department.questions[0],
          })
        )
      : [
          {
            department: activeDepartment,
            question:
              activeDepartment.questions[0],
          },
          {
            department: activeDepartment,
            question:
              activeDepartment.questions[1],
          },
          {
            department: activeDepartment,
            question:
              activeDepartment.questions[2],
          },
        ];

  return (
    <div className="assistant-empty">
      <div className="assistant-empty-content">
        <div className="assistant-empty-eyebrow">
          NORTHBRIDGE HR HELPDESK
        </div>

        <h2>
          What can I help
          <br />
          <span>you find?</span>
        </h2>

        <p>
          Ask about HR policies, check your leave balance, or
          raise an HR ticket. Edith answers from the HR
          documents and cites the source.
        </p>

        <div className="assistant-suggestions">
          {suggestions
            .slice(0, 4)
            .map(
              ({
                department,
                question,
              }) => (
                <button
                  key={question}
                  onClick={() =>
                    openAssistant(
                      question,
                      department.id
                    )
                  }
                  style={{
                    "--suggestion-color":
                      department.color,
                    "--suggestion-soft":
                      department.soft,
                  }}
                >
                  <DepartmentIcon
                    department={
                      department
                    }
                    size={19}
                  />

                  <span>{question}</span>

                  <ArrowUpRight
                    size={16}
                  />
                </button>
              )
            )}
        </div>
      </div>

      <Composer
        input={input}
        setInput={setInput}
        askEdith={askEdith}
        handleKeyDown={handleKeyDown}
        composerRef={composerRef}
        activeDepartment={
          activeDepartment
        }
        selectedDepartment={
          selectedDepartment
        }
        loading={false}
      />
    </div>
  );
}

/* =========================================================
   COMPOSER
========================================================= */

function Composer({
  input,
  setInput,
  askEdith,
  handleKeyDown,
  composerRef,
  activeDepartment,
  selectedDepartment,
  loading,
}) {
  return (
    <div className="composer-area">
      <div className="composer">
        <textarea
          ref={composerRef}
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Ask Edith about a company policy..."
          rows={1}
          disabled={loading}
        />

        <button
          className="composer-send"
          onClick={() => askEdith()}
          disabled={
            !input.trim() || loading
          }
        >
          {loading ? (
            <span className="send-loader"></span>
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      <div className="composer-helper">
        <span>
          Answers are based on indexed
          Northbridge documents.
        </span>

        <span>
          {selectedDepartment !==
            "All topics" && (
            <strong>
              {activeDepartment.name} ·{" "}
            </strong>
          )}
          Enter to send · Shift + Enter
          for new line
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   CHAT
========================================================= */

function ChatConversation({
  messages,
  loading,
  setCitation,
  copyAnswer,
  copied,
  employeeId,
}) {
  return (
    <div className="conversation">
      <div className="conversation-inner">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-row ${message.role}`}
          >
            {message.role === "user" ? (
              <div className="user-message">
                {message.text}
              </div>
            ) : (
              <div className="assistant-message">
                <div className="assistant-message-heading">
                  <EdithMark small />
                  <strong>Edith</strong>
                </div>

                <div className="assistant-answer">
                  {message.error && (
                    <div className="error-banner">
                      <CircleHelp size={17} />
                      Service connection issue
                    </div>
                  )}

                  <RichText text={message.text} />

                  {!message.grounded &&
                    !message.error &&
                    !message.ticketOffer && (
                      <div className="uncertain-state">
                        <CircleHelp size={18} />

                        <div>
                          <strong>
                            I couldn't find enough
                            evidence.
                          </strong>

                          <span>
                            Try asking the question differently, or raise an HR ticket below.
                          </span>
                        </div>
                      </div>
                    )}

                  {message.sources?.length >
                    0 &&
                    !message.ticketOffer && (
                    <div className="answer-sources">
                      <div className="answer-sources-heading">
                        <span>
                          Sources
                        </span>

                        <span>
                          {
                            message
                              .sources
                              .length
                          }
                        </span>
                      </div>

                      {message.sources
                        .slice(0, 3)
                        .map(
                          (
                            source,
                            index
                          ) => (
                            <button
                              className="answer-source"
                              key={`${source.name}-${index}`}
                              onClick={() =>
                                setCitation(
                                  source
                                )
                              }
                            >
                              <span className="source-index">
                                {index +
                                  1}
                              </span>

                              <SourceIcon
                                type={
                                  source.type
                                }
                              />

                              <div>
                                <strong>
                                  {
                                    source.name
                                  }
                                </strong>

                                <span>
                                  {source.section
                                    ? source.section
                                    : source.page
                                    ? `Page ${source.page}`
                                    : "Relevant passage"}
                                </span>
                              </div>

                              <ArrowUpRight
                                size={
                                  16
                                }
                              />
                            </button>
                          )
                        )}
                    </div>
                  )}

                  {message.ticketOffer && (
                    <TicketCard
                      offer={message.ticketOffer}
                      employeeId={employeeId}
                    />
                  )}

                  <div className="answer-actions">
                    <button
                      onClick={() =>
                        copyAnswer(
                          message.text
                        )
                      }
                    >
                      {copied ? (
                        <Check size={15} />
                      ) : (
                        <Copy size={15} />
                      )}

                      {copied
                        ? "Copied"
                        : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message-row assistant">
            <div className="assistant-message">
              <div className="assistant-message-heading">
                <EdithMark small />
                <strong>Edith</strong>
              </div>

              <div className="retrieval-status">
                <div className="search-animation">
                  <Search size={16} />
                </div>

                <div>
                  <strong>
                    Searching the knowledge base
                  </strong>

                  <span>
                    Finding the most relevant policy
                    evidence...
                  </span>
                </div>

                <span className="typing-dots">
                  <i></i>
                  <i></i>
                  <i></i>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   HR HELPDESK: RICH TEXT, TICKET CARD, SIGN-IN
========================================================= */

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

// Shows "- bullet" lines as a list and **bold** as bold, without using dangerouslySetInnerHTML.
function RichText({ text }) {
  const blocks = [];
  let list = [];

  const flush = () => {
    if (list.length) {
      blocks.push({ type: "ul", items: list });
      list = [];
    }
  };

  String(text || "")
    .split("\n")
    .forEach((line) => {
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);

      if (bullet) {
        list.push(bullet[1]);
      } else {
        flush();
        if (line.trim()) blocks.push({ type: "p", text: line });
      }
    });

  flush();

  return (
    <div className="rich-text">
      {blocks.map((block, i) =>
        block.type === "ul" ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderInline(block.text)}</p>
        )
      )}
    </div>
  );
}

function TicketCard({ offer, employeeId }) {
  const [state, setState] = useState("idle");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  async function raiseTicket() {
    setState("loading");
    setError("");

    try {
      const response = await fetch("/api/hr/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: offer.question,
          employee_id: employeeId || null,
          category: offer.category,
          priority: offer.priority,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Could not create the ticket.");
      }

      setTicket(data);
      setState("done");
    } catch (e) {
      setError(e.message || "Could not create the ticket.");
      setState("idle");
    }
  }

  if (state === "done" && ticket) {
    return (
      <div className="ticket-card done">
        <div className="ticket-card-icon">
          <Check size={18} />
        </div>

        <div className="ticket-card-body">
          <strong>Ticket {ticket.ticket_id} raised</strong>
          <span>
            {ticket.category} · Priority {ticket.priority} · Status{" "}
            {ticket.status}
          </span>
          <span>
            HR will respond within {ticket.first_response_within}. Quote
            this number to hrhelpdesk@northbridge.example for updates.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-card">
      <div className="ticket-card-icon">
        <Ticket size={18} />
      </div>

      <div className="ticket-card-body">
        <strong>Raise an HR ticket?</strong>
        <span>
          {offer.category} · Priority {offer.priority}
        </span>
        <span className="ticket-question">
          "{String(offer.question || "").slice(0, 140)}"
        </span>
        {error && <span className="ticket-error">{error}</span>}
      </div>

      <button
        className="ticket-button"
        onClick={raiseTicket}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Raising..." : "Raise ticket"}
      </button>
    </div>
  );
}

function SignInModal({ onSignIn, onClose }) {
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Employee IDs for the drop-down (demo only: a real company would never list its staff).
  useEffect(() => {
    fetch("/api/hr/employees")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setEmployees(data);
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    const message = await onSignIn(id);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="signin-overlay" onClick={onClose}>
      <div className="signin-card" onClick={(e) => e.stopPropagation()}>
        <div className="signin-top">
          <EdithMark />

          <button className="signin-close" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>

        <h3>Sign in to the HR Helpdesk</h3>

        <p>
          Choose your employee ID from the list (or type it) to see your own
          leave balance and tickets.
        </p>

        {employees.length > 0 && (
          <>
            <select
              className="signin-select"
              value={id}
              onChange={(e) => setId(e.target.value)}
              aria-label="Choose your employee ID"
            >
              <option value="">Choose your employee ID</option>

              {employees.map((emp) => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.employee_id} · {emp.name} ({emp.department})
                </option>
              ))}
            </select>

            <div className="signin-or">or type it below</div>
          </>
        )}

        <input
          className="signin-input"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Employee ID, e.g. NB1001"
        />

        {error && <div className="signin-error">{error}</div>}

        <button
          className="primary-cta signin-submit"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Checking..." : "Sign in"}
        </button>

        <button className="signin-skip" onClick={onClose}>
          Continue without signing in
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   CITATION PANEL
========================================================= */

function CitationPanel({
  citation,
  onClose,
}) {
  return (
    <div
      className="citation-overlay"
      onClick={onClose}
    >
      <aside
        className="citation-panel"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="citation-panel-header">
          <div>
            <span>
              SOURCE EVIDENCE
            </span>

            <h3>{citation.name}</h3>
          </div>

          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="citation-meta">
          <span>
            <FileText size={15} />
            {citation.type?.toUpperCase() ||
              "DOCUMENT"}
          </span>

          {citation.section && (
            <span>
              <BookOpen size={15} />
              {citation.section}
            </span>
          )}

          {citation.page && (
            <span>
              <BookOpen size={15} />
              Page {citation.page}
            </span>
          )}
        </div>

        <div className="citation-passage">
          <div className="citation-passage-label">
            RELEVANT PASSAGE
          </div>

          <blockquote>
            {citation.text ||
              "The retrieved source passage is available from the connected knowledge base."}
          </blockquote>
        </div>

        <div className="citation-note">
          <Check size={17} />

          <span>
            This source was retrieved as
            supporting evidence for Edith's
            response.
          </span>
        </div>
      </aside>
    </div>
  );
}

export default App;