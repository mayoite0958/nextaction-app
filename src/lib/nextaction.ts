export type RoleTemplate = {
  id: string;
  label: string;
  urgentLabel: string;
  longtermLabel: string;
  urgentShare: number;
  valueLabel: string;
};

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "job_seeker",
    label: "Job seeker",
    urgentLabel: "Applications & recruiter actions",
    longtermLabel: "Skills & portfolio",
    urgentShare: 70,
    valueLabel: "career and income",
  },
  {
    id: "freelancer",
    label: "Freelancer / Agency",
    urgentLabel: "Client delivery",
    longtermLabel: "Business building",
    urgentShare: 80,
    valueLabel: "revenue and client deadlines",
  },
  {
    id: "student",
    label: "Student / Learner",
    urgentLabel: "Assignments & exams",
    longtermLabel: "Deep learning & projects",
    urgentShare: 60,
    valueLabel: "grades and skill growth",
  },
  {
    id: "founder",
    label: "Founder / Creator",
    urgentLabel: "Revenue-critical",
    longtermLabel: "Product & growth",
    urgentShare: 60,
    valueLabel: "revenue and traction",
  },
  {
    id: "custom",
    label: "Custom",
    urgentLabel: "Urgent",
    longtermLabel: "Long-term",
    urgentShare: 70,
    valueLabel: "career and income",
  },
];

export const COACHING_TONES = ["direct", "warm", "neutral"];
export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = deadline.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86400000);
}

export function relativeTime(value: string | null): string {
  if (!value) return "not yet";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
