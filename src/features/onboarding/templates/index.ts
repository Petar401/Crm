export type TemplateKey =
  | "empty"
  | "agency"
  | "consultancy"
  | "trades"
  | "ecommerce"
  | "saas";

export interface OnboardingTemplate {
  key: TemplateKey;
  label: string;
  tagline: string;
  extraPipelines: Array<{
    name: string;
    stages: Array<{ name: string; color: string }>;
  }>;
  sampleCompanies: Array<{
    name: string;
    industry: string;
    website?: string;
  }>;
}

const BASE_STAGE_COLORS = ["#94a3b8", "#60a5fa", "#f59e0b", "#a855f7", "#22c55e", "#ef4444"];
const s = (name: string, i: number) => ({ name, color: BASE_STAGE_COLORS[i % BASE_STAGE_COLORS.length] });

export const TEMPLATES: OnboardingTemplate[] = [
  {
    key: "empty",
    label: "Start empty",
    tagline: "Just the default sales pipeline — bring your own data.",
    extraPipelines: [],
    sampleCompanies: [],
  },
  {
    key: "agency",
    label: "Agency",
    tagline: "Retainers + project delivery pipelines for creative or dev shops.",
    extraPipelines: [
      {
        name: "New Business",
        stages: ["Discovery", "Proposal", "Contract", "Won", "Lost"].map(s),
      },
      {
        name: "Delivery",
        stages: ["Kickoff", "In Progress", "Review", "Delivered"].map(s),
      },
    ],
    sampleCompanies: [
      { name: "Nimbus Creative", industry: "Marketing", website: "nimbus.example" },
      { name: "Loomcraft Studio", industry: "Design", website: "loomcraft.example" },
    ],
  },
  {
    key: "consultancy",
    label: "Consultancy",
    tagline: "Discovery-heavy sales cycles for professional services.",
    extraPipelines: [
      {
        name: "Engagements",
        stages: ["Intro", "Scoping", "SoW", "Delivery", "Complete"].map(s),
      },
    ],
    sampleCompanies: [
      { name: "Meridian Advisors", industry: "Strategy" },
      { name: "Northwind Partners", industry: "Finance" },
    ],
  },
  {
    key: "trades",
    label: "Trades",
    tagline: "Quote → Schedule → Job flow for plumbers, electricians, builders.",
    extraPipelines: [
      {
        name: "Jobs",
        stages: ["Enquiry", "Site Visit", "Quoted", "Scheduled", "Completed", "Invoiced"].map(s),
      },
    ],
    sampleCompanies: [
      { name: "Green Valley Plumbing", industry: "Plumbing" },
      { name: "Brightspark Electrics", industry: "Electrical" },
    ],
  },
  {
    key: "ecommerce",
    label: "E-commerce",
    tagline: "B2B wholesale + partner-management pipelines.",
    extraPipelines: [
      {
        name: "Wholesale",
        stages: ["Application", "Approved", "First Order", "Repeat", "Churn"].map(s),
      },
    ],
    sampleCompanies: [
      { name: "Harbor Goods Co.", industry: "Retail" },
      { name: "Fjord Supply", industry: "Distribution" },
    ],
  },
  {
    key: "saas",
    label: "B2B SaaS",
    tagline: "PLG + sales-assist pipelines with a renewals track.",
    extraPipelines: [
      {
        name: "Enterprise",
        stages: ["MQL", "SQL", "Discovery", "POC", "Procurement", "Closed Won", "Closed Lost"].map(s),
      },
      {
        name: "Renewals",
        stages: ["Upcoming", "Negotiation", "Renewed", "Churned"].map(s),
      },
    ],
    sampleCompanies: [
      { name: "Cortex Robotics", industry: "Manufacturing" },
      { name: "Beacon Analytics", industry: "Data" },
    ],
  },
];

export function getTemplate(key: TemplateKey): OnboardingTemplate {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
}
