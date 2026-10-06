# HR Helpdesk Bot: test results

Run on: 2026-10-05 12:53  |  Server: http://localhost:8080

| Group | Questions | Passed | Failed | Accuracy |
|---|---|---|---|---|
| A. Policy Q&A | 34 | 31 | 3 | 91% |
| B. Leave balance | 9 | 9 | 0 | 100% |
| C. Ticket fallback | 8 | 6 | 2 | 75% |
| D. Safety and tricky | 9 | 8 | 1 | 89% |
| E. Follow-up questions | 3 | 2 | 1 | 67% |
| **Total** | **63** | **56** | **7** | **89%** |

## Failed questions

**Q11: How many public holidays are there?**
- Why: none of 'floating'
- Bot said: 12 public holidays, as stated in the leave policy. This is a fixed number each year with no replacement if a holiday falls on a weekend (Source: HR-02 Leave Policy, Section 13).

**Q25: What does health insurance cover?**
- Why: none of '5,00,000' / '500,000' / '5 lakh' / '500000'
- Bot said: Rs. 5 ,00 000 per family per year for you, your spouse and up to two children, starting on the date of joining. Parents can be added at group rates. (Source: HR-13 HR Quick FAQ, Section Pay and Benefits; HR-06 Compensation, Payroll and Benefits Policy, Section 7.1)

**Q31: What increment can I expect for a rating of 4?**
- Why: none of '9% to 11%' / '9%-11%' / '9-11%' / '9% and 11%' / '9 to 11' / '9% - 11%'
- Bot said: I can't share another person's personal data such as salary, ratings or leave balance. I can only show you your own leave balance. For salary questions about yourself, write to payroll@northbridge.example.

**Q46: What is maternity leave for twins?**
- Why: no ticket offered
- Bot said: 26 weeks.   | Eligible female employees who have worked at least 80 days in the 12 months before the expected delivery date are entitled to 26 weeks of paid leave for the first two children, so twins count as two and qualify for that amount. (Source: HR-02 Leave Policy, Section 8)

**Q47: My salary has not been credited**
- Why: no ticket offered; priority was None, expected P1
- Bot said: I couldn't find anything in the available department documents that answers this question. It may be outside the scope of what's been indexed, or phrased differently than how it appears in the source documents.

**Q60: What does the Finance policy say about hotel limits?**
- Why: neither a ticket nor finance
- Bot said: I couldn't find anything in the available department documents that answers this question. It may be outside the scope of what's been indexed, or phrased differently than how it appears in the source documents.

**QE2: What is the notice period?  >>  And for a manager (B5)?**
- Why: missing '90 days'
- Bot said: Rs. 40,000 – paid after the referred employee completes 6 months and both the referrer and the new joiner must still be employed. (Source: HR-06 Compensation, Payroll and Benefits Policy, Section 7.6)
