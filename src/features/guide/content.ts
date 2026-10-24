/** In-app guide content. Plain data so it can be searched; steps use the product's own words. */
export interface GuideTopic {
  id: string;
  title: string;
  summary: string;
  steps?: string[];
  notes?: string[];
  link?: { label: string; href: string };
}

export interface GuideSection {
  id: string;
  title: string;
  topics: GuideTopic[];
}

export const GUIDE: GuideSection[] = [
  {
    id: "start",
    title: "Getting started",
    topics: [
      {
        id: "find-your-way",
        title: "Find your way around",
        summary: "The sidebar groups the CRM by job: Customers, Sales, Engagement, Service and Files.",
        steps: ["Use the sidebar to open a module. Collapse it with Collapse at the bottom.", "Press ⌘K (Ctrl+K on Windows) to search contacts and jump to any page.", "The bell shows things that need you, such as overdue tasks and new assignments.", "The Dashboard shows what needs your attention today for your role."],
        link: { label: "Open the dashboard", href: "/dashboard" },
      },
      {
        id: "roles",
        title: "Roles and what you can do",
        summary: "What you see and change depends on your role. Users work with their own records, Sales Managers with their team's, Admins with everyone's. Viewers can look but not change anything.",
        steps: ["Open the profile menu (top right) to see your role.", "In this prototype you can switch role from the same menu to see the CRM as someone else."],
        notes: ["Buttons you can't use are hidden or explained — the CRM never fails silently."],
      },
      {
        id: "demo-data",
        title: "About the demo data",
        summary: "Everything here is fictional and stays in your browser. Nothing is sent to customers, banks or other systems.",
        steps: ["To start again, open the profile menu and choose Reset demo data."],
        notes: ["Messages, campaign sends, quote links, payments and ratings are simulated and labelled as such.", "Uploaded files are kept in this browser only."],
      },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    topics: [
      {
        id: "add-contact",
        title: "Add a contact",
        summary: "A contact is a person you have a relationship with.",
        steps: ["Go to Contacts and choose New contact.", "Enter a name and at least one way to reach them. The CRM warns you if the phone or email already belongs to someone.", "Add an owner, a company and tags if you know them, then Save."],
        link: { label: "Open Contacts", href: "/contacts" },
      },
      {
        id: "find-contacts",
        title: "Find, filter and save views",
        summary: "Search by name, phone, email or company and narrow the list with filters.",
        steps: ["Type in the search box — phone numbers match however they're written.", "Use Owner, Source, Status and Tags to narrow the list. Active filters show as chips you can remove.", "Save a view to come back to the same filters later."],
      },
      {
        id: "consent",
        title: "Record communication preferences",
        summary: "Record whether a customer agreed to marketing or service messages, per channel. Messages and campaigns check these before anything goes out.",
        steps: ["Open a contact and find Communication preferences.", "Choose the channel and purpose, record the decision and how it was given, then save.", "History is never overwritten — every change is kept."],
      },
      {
        id: "import-contacts",
        title: "Import contacts",
        summary: "Bring in contacts from a CSV or Excel file. Nothing changes until you confirm.",
        steps: ["Go to Contacts → Import and choose a file (or Use sample file).", "Check the column matching and the row results: New, Update, Skip or Error.", "Confirm to import. Download the problem rows to fix and try again."],
        link: { label: "Import contacts", href: "/contacts/import" },
      },
      {
        id: "duplicates",
        title: "Merge duplicate contacts",
        summary: "The CRM spots contacts that share a phone number or email.",
        steps: ["Open Contacts → Duplicates.", "Compare the records side by side and pick the values to keep.", "Merge. Activities, deals, tickets and files move to the kept contact. Or mark them as Not duplicates."],
        link: { label: "Review duplicates", href: "/contacts/duplicates" },
      },
      {
        id: "accounts",
        title: "Accounts, head offices and branches",
        summary: "Accounts are organisations. A branch can sit under a head office.",
        steps: ["Go to Accounts and choose New account.", "Pick a parent account to make it a branch.", "Open an account to see its contacts, branches, deals and history."],
        link: { label: "Open Accounts", href: "/accounts" },
      },
      {
        id: "segments",
        title: "Build a segment",
        summary: "A segment is a saved group of contacts that updates itself, such as everyone in Greater Accra who agreed to SMS marketing.",
        steps: ["Go to Segments → New segment.", "Add conditions. A contact must match every condition.", "Watch the live count and preview, then save it as private or shared."],
        notes: ["Campaigns use shared segments as their audience."],
        link: { label: "Open Segments", href: "/segments" },
      },
    ],
  },
  {
    id: "sales",
    title: "Sales",
    topics: [
      {
        id: "leads",
        title: "Work and convert a lead",
        summary: "A lead is someone who might buy. Qualify the good ones and convert them.",
        steps: ["Go to Leads → New lead, or open an existing lead.", "Log calls and set a next action. The score shows why a lead looks promising.", "When they're ready, choose Convert: link or create the contact and company, and optionally a deal."],
        notes: ["The lead score is a prototype model and shows each factor."],
        link: { label: "Open Leads", href: "/leads" },
      },
      {
        id: "deals",
        title: "Create a deal",
        summary: "A deal is an opportunity you're working to win.",
        steps: ["Go to Deals → New deal.", "Choose a contact, stage and expected close date.", "Enter a value, or switch to Products and add line items with quantity, discount and tax.", "Save. The deal workspace shows activity, quotes, files and history."],
        link: { label: "New deal", href: "/deals/new" },
      },
      {
        id: "pipeline",
        title: "Move deals on the pipeline",
        summary: "The pipeline shows open deals by stage, with totals per currency.",
        steps: ["Drag a card to another stage, or use its Move menu (works with the keyboard).", "Drop on Won or Lost — or choose Mark won/lost — to close a deal. You'll be asked for the date, value and reason."],
        notes: ["A deal is never closed without that confirmation. GHS and USD are never added together."],
        link: { label: "Open Pipeline", href: "/pipeline" },
      },
      {
        id: "quotes",
        title: "Send a quote",
        summary: "Quotes are created from a deal so the customer and prices come with them.",
        steps: ["Open a deal and choose New quote. Adjust the items, dates and terms, then save the draft.", "Send it to record who it went to and get the customer link.", "Record the customer's answer, or open the customer link to try it as them. Record payment when it's paid."],
        notes: ["Accepting a quote never marks the deal won by itself — you'll be prompted to do it.", "Sending, the customer link and payments are simulated."],
        link: { label: "Open Quotes", href: "/quotes" },
      },
      {
        id: "products",
        title: "Manage products",
        summary: "Products give deals and quotes consistent prices.",
        steps: ["Go to Products → New product.", "Enter the name, price, currency, tax and the unit you sell it in. The page shows what the customer will pay.", "Switch a product off to stop it being added to new deals."],
        notes: ["Products from MyStoreGuard are edited there; here you can only switch them on or off."],
        link: { label: "Open Products", href: "/products" },
      },
      {
        id: "forecast",
        title: "Read the forecast",
        summary: "The forecast answers three questions: how much have we won, what's likely to close, and are we on track.",
        steps: ["Choose the period, whose deals, and the currency.", "Weighted value = deal value × chance of winning.", "Click a breakdown row to see the deals behind it."],
        link: { label: "Open Forecast", href: "/forecast" },
      },
      {
        id: "import-deals",
        title: "Import deals",
        summary: "Bring in open, won and lost deals from a spreadsheet.",
        steps: ["Go to Deals → Import and choose a file.", "Customers are matched by email, then phone; companies by name.", "Tick Create missing contacts and companies only if you want new ones — they're listed before you confirm."],
        link: { label: "Import deals", href: "/deals/import" },
      },
    ],
  },
  {
    id: "engagement",
    title: "Tasks, calendar and messages",
    topics: [
      {
        id: "plan-activity",
        title: "Plan an activity or log a call",
        summary: "Plan things to do, or record things that already happened. Both appear on the customer's history.",
        steps: ["Go to Tasks & calls and choose New activity.", "Pick the type and To do or Already happened.", "For a planned item set the date, time, priority, reminder and repeat. Then choose Plan it.", "To record a call, choose Log a call: say when, how long, what happened and who called whom. Then choose Log it."],
        notes: ["The CRM doesn't place or record phone calls — you log them."],
        link: { label: "Open Tasks & calls", href: "/activities" },
      },
      {
        id: "views",
        title: "Late, Today, Coming up and Team",
        summary: "Each view shows the same activities sorted by when they're due.",
        steps: ["Late: open items due before today. Today: due today. Coming up: later. No date: open with no date. Done: finished or logged.", "Use Whose to see Mine, Everyone's, Nobody's or one person's.", "Team shows each person's workload. Click a number to open that list."],
      },
      {
        id: "calendar",
        title: "Use the calendar",
        summary: "The calendar shows calls, meetings, visits and tasks with a time.",
        steps: ["Switch between Week and Month, and use Previous, Today and Next.", "Click an empty slot to plan something at that time.", "Hover a card to see its details. Drag it to reschedule — the duration moves with it, and you can Undo.", "Using the keyboard? Tab to a card, press Enter, then Edit."],
        link: { label: "Open Calendar", href: "/calendar" },
      },
      {
        id: "import-activities",
        title: "Import calls, meetings and tasks",
        summary: "Bring in activities from CSV or Excel. Check the file first, then import.",
        steps: ["Go to Tasks & calls → Import.", "Choose Import as: each row says its type, or all Calls, Meetings, Tasks, Visits or Notes.", "The preview shows which rows become done history and which become open to-dos."],
        notes: ["Activities are only matched to existing contacts — new contacts are never created."],
      },
      {
        id: "send-message",
        title: "Send a message",
        summary: "Send SMS, WhatsApp or email to a contact, from their page or from a deal.",
        steps: ["Open the contact or deal and choose Send message.", "Pick the channel and whether it's operational or marketing. The CRM checks their preferences.", "Start from a template if you like, check the preview, then send."],
        notes: ["Delivery is simulated: the status moves to Delivered after a moment."],
      },
      {
        id: "messaging",
        title: "Find a message and its status",
        summary: "Messaging lists everything sent from the CRM, with delivery status and SMS cost.",
        steps: ["Search by recipient, number or wording.", "Filter by Channel, Status, Kind and the Sent date.", "Open a message to see its status history and the permission it was sent under."],
        link: { label: "Open Messaging", href: "/messaging" },
      },
      {
        id: "templates",
        title: "Create a message template",
        summary: "Templates are wording you use again and again, with fields filled in for each person.",
        steps: ["Go to Messaging → Templates → New template.", "Write the message and use Insert field for first name, full name, company or deal.", "Preview it as a real contact. You'll be warned if a field has no value for them."],
        link: { label: "New template", href: "/messaging/templates/new" },
      },
      {
        id: "campaigns",
        title: "Send a campaign",
        summary: "One message to a whole segment — only to people who may receive it — sent in your business hours.",
        steps: ["Go to Campaigns → New campaign. Name it and pick Email or SMS.", "Choose a segment. See who will receive it and who is left out, and why.", "Write the message and check the preview.", "Schedule it within business hours, or Send now after checking the recipient list."],
        notes: ["People without a marketing agreement for the channel, or who opted out, are always left out.", "Sending is simulated; the messages appear in Messaging."],
        link: { label: "Open Campaigns", href: "/campaigns" },
      },
    ],
  },
  {
    id: "service",
    title: "Support tickets",
    topics: [
      {
        id: "open-ticket",
        title: "Open a ticket",
        summary: "A ticket tracks a complaint or request until it's resolved.",
        steps: ["Go to Tickets → New ticket, or choose New ticket on a contact's Tickets tab.", "Choose the customer, describe the issue, and set the category, priority and owner.", "The priority sets two targets: when to reply first, and when to resolve."],
        link: { label: "Open Tickets", href: "/tickets" },
      },
      {
        id: "work-ticket",
        title: "Reply, add notes and resolve",
        summary: "Customer replies and internal notes sit in one conversation.",
        steps: ["Choose Reply to customer, or Internal note for your team only.", "Use Saved answers to insert common wording, then edit it before sending.", "Tick Wait for the customer to switch the status, or Resolve with a short summary.", "Reopen a resolved or closed ticket if the problem returns."],
        notes: ["Replies are simulated and also appear in Messaging."],
      },
      {
        id: "ticket-dashboard",
        title: "Read the service dashboard",
        summary: "See how your team is doing on open tickets, targets and customer ratings.",
        steps: ["Open Tickets → Dashboard and choose a date range.", "Click Open now or Late now to see those tickets.", "— means there's nothing to measure yet. It isn't zero."],
      },
    ],
  },
  {
    id: "files",
    title: "Documents",
    topics: [
      {
        id: "folders-upload",
        title: "Organise and upload files",
        summary: "Keep files in folders and link them to customers, deals, quotes and tickets.",
        steps: ["Go to Documents. Choose New folder, name it and pick a colour.", "Open a folder and Upload, or drag files onto the page.", "Use search, Type and Sort to find files. Switch between Grid and List."],
        link: { label: "Open Documents", href: "/documents" },
      },
      {
        id: "link-files",
        title: "Link a file to a record",
        summary: "One file can appear on a contact, a deal and a ticket at the same time.",
        steps: ["From a file's menu choose Link to a record, then pick the record.", "Or open a contact, deal or ticket and use Upload or Link existing in its Files section."],
      },
      {
        id: "recycle-bin",
        title: "Recycle bin",
        summary: "Binned files and folders can be restored for 30 days.",
        steps: ["From a file or folder menu choose Move to recycle bin.", "Open Recycle bin to Restore or Delete for good. Each item shows when it will be deleted."],
        notes: ["Binned files count toward storage until they're deleted for good."],
      },
    ],
  },
];
