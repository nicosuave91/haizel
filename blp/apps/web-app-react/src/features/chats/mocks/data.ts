export interface Conversation {
  id: string;
  title: string;
  channel: "SMS" | "Email" | "Call";
  unread: number;
  priority?: "high" | "normal";
  loanId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  author: string;
  body: string;
  timestamp: string;
  direction: "inbound" | "outbound";
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export const conversations: Conversation[] = [
  { id: "c1", title: "Malik Carter", channel: "SMS", unread: 2, priority: "high", loanId: "loan-1" },
  { id: "c2", title: "Rivera Family", channel: "Email", unread: 0, loanId: "loan-4" },
  { id: "c3", title: "Appraisal - Metro AMC", channel: "SMS", unread: 1, loanId: "loan-6" }
];

export const messages: Message[] = [
  {
    id: "m1",
    conversationId: "c1",
    author: "Malik Carter",
    body: "We uploaded the income docs—can you confirm?",
    timestamp: new Date().toISOString(),
    direction: "inbound"
  },
  {
    id: "m2",
    conversationId: "c1",
    author: "You",
    body: "Heads up: appraisal scheduled for Thursday at 11a.",
    timestamp: new Date().toISOString(),
    direction: "outbound"
  },
  {
    id: "m3",
    conversationId: "c2",
    author: "You",
    body: "Assist: we just need the updated insurance binder.",
    timestamp: new Date().toISOString(),
    direction: "outbound"
  }
];

export const participants: Record<string, Participant> = {
  c1: {
    id: "p1",
    name: "Malik Carter",
    role: "Borrower",
    phone: "+1 555-202-1200",
    email: "malik@borrower.com"
  },
  c2: {
    id: "p2",
    name: "Rivera Family",
    role: "Borrowers",
    phone: "+1 555-404-3344",
    email: "rivera@borrower.com"
  },
  c3: {
    id: "p3",
    name: "Metro Appraisals",
    role: "Vendor",
    phone: "+1 555-989-2211",
    email: "team@metroamc.com"
  }
};
