// Typed, server-side Directus access layer.
// All reads are authenticated with the static token (no public permissions required)
// and every read fails safe: the homepage always returns a complete, non-empty object,
// and services returns [] when Directus is unreachable.

// Homepage singleton — text content for the Thrive homepage, section by section.
// "*_html" fields hold rich HTML (rendered with set:html) so bold/links stay editable.
export interface Homepage {
  seo_title: string;
  seo_description: string;
  // Hero
  hero_eyebrow: string;
  hero_heading_pre: string;
  hero_heading_em: string;
  hero_sub: string;
  hero_trust_list: string; // newline-separated
  hero_team_label: string;
  form_eyebrow: string;
  form_headline: string;
  form_sub: string;
  form_button: string;
  form_fineprint: string;
  form_success_heading: string;
  form_success_text: string;
  // Trust strip
  ts_google_num: string;
  ts_clutch_num: string;
  ts_reviews_text: string;
  ts_reviews_url: string;
  awards_eyebrow: string;
  // Results (videos)
  results_h2: string;
  results_sub: string;
  results_cta_text: string;
  results_cta_url: string;
  // Wins
  wins_h2: string;
  wins_sub: string;
  // Inc 5000 callout
  inc_headline: string;
  inc_body_html: string;
  inc_cta_text: string;
  inc_cta_url: string;
  // Voices / positioning
  voices_h2: string;
  voices_body_html: string;
  voices_cta_text: string;
  voices_cta_url: string;
  // AI visibility
  aiv_h2_pre: string;
  aiv_h2_em: string;
  aiv_sub: string;
  aiv_body_html: string;
  aiv_cta_text: string;
  aiv_cta_url: string;
  aiv_stat1_num: string;
  aiv_stat1_lab: string;
  aiv_stat2_num: string;
  aiv_stat2_lab: string;
  aiv_stat3_num: string;
  aiv_stat3_lab: string;
  // How we grow
  grow_h2: string;
  grow_body_html: string;
  // Rankings
  rankings_h2: string;
  rankings_sub: string;
  rk_pill1: string;
  rk_pill2: string;
  rk_pill3: string;
  // Why choose
  why_eyebrow: string;
  why_h2: string;
  why_body_html: string;
  why_team_h3: string;
  why_cta_text: string;
  why_cta_url: string;
  // Closing CTA
  closing_h2: string;
  closing_text: string;
  closing_cta1_text: string;
  closing_cta2_text: string;
  // Footer
  footer_h2_pre: string;
  footer_h2_em: string;
  footer_desc_html: string;
  footer_cta_h3: string;
  footer_cta_text: string;
}

// Repeatable homepage collections
export interface HomeResult {
  video_url: string; video_id: string; quote: string; attrib: string;
  stat1_num: string; stat1_lab: string; stat2_num: string; stat2_lab: string;
  stat3_num: string; stat3_lab: string; link_text: string; link_url: string;
}
export interface HomeWin {
  pill: string; logo: string; hero_num: string; hero_lab: string;
  stat1: string; stat2: string; services: string; link_text: string; link_url: string;
}
export interface AivCard { title: string; url: string; body: string; }
export interface ToolCard { logo: string; heading: string; body_html: string; learn_url: string; visual: string; }
export interface ValueCard { title: string; body: string; }
export interface Testimonial { image: string; alt: string; }

// Fallback copy — also used as the source of truth when a field is left blank in the CMS.
export const DEFAULT_HOMEPAGE: Homepage = {
  seo_title: 'Digital Marketing Agency Driven by Relationships and Results | Thrive',
  seo_description:
    'Thrive is a digital marketing agency that delivers booked leads and measurable revenue growth. Free strategy proposal, no long-term contracts.',
  hero_eyebrow: 'Free Digital Marketing Strategy, No Commitment',
  hero_heading_pre: 'Digital Marketing Agency Driven by',
  hero_heading_em: 'Relationships and Results',
  hero_sub:
    'Since 2005, Thrive has grown over 8,000 businesses with strategy-first digital marketing. A senior marketing consultant reaches out within 5 minutes to scope your free proposal.',
  hero_trust_list:
    'No long-term contracts\n20+ years, 8,000+ businesses grown\nFree strategy proposal\nGoogle Premier Partner',
  hero_team_label: 'Get scheduled with a senior marketing consultant within 5 minutes',
  form_eyebrow: 'Free Proposal · No Commitment',
  form_headline: 'Get Your FREE Digital Marketing Proposal',
  form_sub:
    'Tell us about your business. A senior marketing consultant follows up within 5 minutes to scope a free strategy call.',
  form_button: 'GET MY FREE PROPOSAL →',
  form_fineprint: 'We respect your inbox. Used only for your proposal.',
  form_success_heading: 'Got It, Proposal Incoming',
  form_success_text:
    'A senior marketing consultant will reach out within 5 minutes to schedule your strategy call. If urgent, call (888) 342-0534.',
  ts_google_num: '', ts_clutch_num: '', ts_reviews_text: '', ts_reviews_url: '',
  awards_eyebrow: '',
  results_h2: '', results_sub: '', results_cta_text: '', results_cta_url: '',
  wins_h2: '', wins_sub: '',
  inc_headline: '', inc_body_html: '', inc_cta_text: '', inc_cta_url: '',
  voices_h2: '', voices_body_html: '', voices_cta_text: '', voices_cta_url: '',
  aiv_h2_pre: '', aiv_h2_em: '', aiv_sub: '', aiv_body_html: '', aiv_cta_text: '', aiv_cta_url: '',
  aiv_stat1_num: '', aiv_stat1_lab: '', aiv_stat2_num: '', aiv_stat2_lab: '', aiv_stat3_num: '', aiv_stat3_lab: '',
  grow_h2: '', grow_body_html: '',
  rankings_h2: '', rankings_sub: '', rk_pill1: '', rk_pill2: '', rk_pill3: '',
  why_eyebrow: '', why_h2: '', why_body_html: '', why_team_h3: '', why_cta_text: '', why_cta_url: '',
  closing_h2: '', closing_text: '', closing_cta1_text: '', closing_cta2_text: '',
  footer_h2_pre: '', footer_h2_em: '', footer_desc_html: '', footer_cta_h3: '', footer_cta_text: '',
};

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL;
const DIRECTUS_STATIC_TOKEN = import.meta.env.DIRECTUS_STATIC_TOKEN;

async function directusGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Directus request failed (${res.status}) for ${path}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

// Overlay any non-empty CMS string onto the defaults so no field is ever blank.
function mergeHomepage(data: Partial<Homepage>): Homepage {
  const result: Homepage = { ...DEFAULT_HOMEPAGE };
  for (const key of Object.keys(DEFAULT_HOMEPAGE) as Array<keyof Homepage>) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
  }
  return result;
}

export async function getHomepage(): Promise<Homepage> {
  try {
    const data = await directusGet<Partial<Homepage> | null>('/items/homepage');
    if (!data) return { ...DEFAULT_HOMEPAGE };
    return mergeHomepage(data);
  } catch {
    return { ...DEFAULT_HOMEPAGE };
  }
}

async function getList<T>(collection: string): Promise<T[]> {
  try {
    const data = await directusGet<T[]>(`/items/${collection}?filter[status][_eq]=published&sort=sort&limit=-1`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const getHomeResults = () => getList<HomeResult>('home_results');
export const getHomeWins = () => getList<HomeWin>('home_wins');
export const getHomeAiv = () => getList<AivCard>('home_aiv');
export const getHomeTools = () => getList<ToolCard>('home_tools');
export const getHomeValues = () => getList<ValueCard>('home_values');
export const getTestimonials = () => getList<Testimonial>('testimonials');

// ---------------------------------------------------------------------------
// About page (singleton) — same fail-safe pattern as the homepage.
// ---------------------------------------------------------------------------

export interface About {
  seo_title: string;
  seo_description: string;
  hero_eyebrow: string;
  hero_heading: string;
  hero_subheading: string;
  story_heading: string;
  story_body: string;
  stat1_value: string;
  stat1_label: string;
  stat2_value: string;
  stat2_label: string;
  stat3_value: string;
  stat3_label: string;
  stat4_value: string;
  stat4_label: string;
  mission_heading: string;
  mission_body: string;
  cta_heading: string;
  cta_text: string;
  cta_button_label: string;
  cta_button_url: string;
  // Optimize / Generate / Grow section (three icon cards + two CTAs)
  og_intro: string;
  og_card1_icon: string; // Lucide icon name (e.g. "settings")
  og_card1_title: string;
  og_card1_sub: string;
  og_card2_icon: string;
  og_card2_title: string;
  og_card2_sub: string;
  og_card3_icon: string;
  og_card3_title: string;
  og_card3_sub: string;
  og_cta1_text: string;
  og_cta1_url: string;
  og_cta2_text: string;
  og_cta2_url: string;
}

export const DEFAULT_ABOUT: About = {
  seo_title: 'About Us | ThriveAgency Clone',
  seo_description:
    'We are a growth-obsessed digital marketing team pairing creative strategy with engineering rigor to drive measurable revenue.',
  hero_eyebrow: 'About The Agency',
  hero_heading: 'Growth-obsessed marketers, engineering-grade execution.',
  hero_subheading:
    'We blend creative strategy with a fast, headless tech stack to turn marketing spend into predictable, compounding revenue for ambitious brands.',
  story_heading: 'Our Story',
  story_body:
    'Founded on a simple belief — that marketing should be measurable — we set out to close the gap between brand storytelling and hard revenue.\n\nToday we run full-funnel programs for companies that want more than vanity metrics. Every campaign is wired to a structured data layer, so the impact of every dollar is transparent and accountable.',
  stat1_value: '12+',
  stat1_label: 'Years of combined expertise',
  stat2_value: '$250M+',
  stat2_label: 'Client revenue influenced',
  stat3_value: '500+',
  stat3_label: 'Campaigns launched',
  stat4_value: '98%',
  stat4_label: 'Client retention rate',
  mission_heading: 'Our Mission',
  mission_body:
    'To be the most accountable growth partner our clients have ever worked with — obsessed with outcomes, allergic to fluff, and relentless about the numbers that actually move the business.',
  cta_heading: 'Ready to drive real growth?',
  cta_text: 'Tell us about your objectives and we will put together a tailored proposal.',
  cta_button_label: 'Get Your Free Proposal',
  cta_button_url: '/',
  og_intro:
    'Thrive Internet Marketing Agency is an award-winning digital marketing company that offers a full spectrum of data-driven web marketing services. We develop growth-oriented online marketing campaigns that make a positive impact on businesses.',
  og_card1_icon: 'settings', og_card1_title: 'OPTIMIZE', og_card1_sub: 'Marketing Processes',
  og_card2_icon: 'circle-check', og_card2_title: 'GENERATE', og_card2_sub: 'Targeted Results',
  og_card3_icon: 'bar-chart-3', og_card3_title: 'GROW', og_card3_sub: 'Your Brand Online',
  og_cta1_text: 'STRATEGY-FIRST AGENCY', og_cta1_url: '/',
  og_cta2_text: 'GET MY FREE PROPOSAL', og_cta2_url: '/',
};

function mergeAbout(data: Partial<About>): About {
  const result: About = { ...DEFAULT_ABOUT };
  for (const key of Object.keys(DEFAULT_ABOUT) as Array<keyof About>) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
  }
  return result;
}

export async function getAbout(): Promise<About> {
  try {
    const data = await directusGet<Partial<About> | null>('/items/about');
    if (!data) return { ...DEFAULT_ABOUT };
    return mergeAbout(data);
  } catch {
    return { ...DEFAULT_ABOUT };
  }
}

// ---------------------------------------------------------------------------
// Search results page (singleton) — CMS-editable labels, same fail-safe pattern.
// ---------------------------------------------------------------------------

export interface SearchPage {
  seo_title: string;
  results_heading: string;
  no_results_text: string;
  empty_prompt: string;
  input_placeholder: string;
}

export const DEFAULT_SEARCH_PAGE: SearchPage = {
  seo_title: 'Search',
  results_heading: 'Search Results For:',
  no_results_text: 'Sorry, no posts were found.',
  empty_prompt: 'Enter a term above to search the site.',
  input_placeholder: 'Search this website',
};

function mergeSearchPage(data: Partial<SearchPage>): SearchPage {
  const result: SearchPage = { ...DEFAULT_SEARCH_PAGE };
  for (const key of Object.keys(DEFAULT_SEARCH_PAGE) as Array<keyof SearchPage>) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
  }
  return result;
}

export async function getSearchPage(): Promise<SearchPage> {
  try {
    const data = await directusGet<Partial<SearchPage> | null>('/items/search_page');
    if (!data) return { ...DEFAULT_SEARCH_PAGE };
    return mergeSearchPage(data);
  } catch {
    return { ...DEFAULT_SEARCH_PAGE };
  }
}

// ---------------------------------------------------------------------------
// Site header (singleton) + nav items (repeatable) — CMS-editable, fail-safe.
// ---------------------------------------------------------------------------

export interface HeaderData {
  logo_text: string;
  logo_url: string;
  phone: string;
}

export interface NavSubItem {
  id: number;
  label: string;
  url: string;
  parent: number | null;
}

export interface NavItem {
  id: number;
  label: string;
  url: string;
  has_dropdown: boolean;
  subitems: NavSubItem[];
}

export const DEFAULT_HEADER: HeaderData = {
  logo_text: 'thrive',
  logo_url: '/thrive-logo.svg',
  phone: '843-353-6383',
};

export const DEFAULT_NAV: NavItem[] = [
  { id: 1, label: 'SERVICES', url: '#', has_dropdown: true, subitems: [] },
  { id: 2, label: 'LOCAL', url: '#', has_dropdown: true, subitems: [] },
  { id: 3, label: 'RESULTS', url: '#', has_dropdown: true, subitems: [] },
  { id: 4, label: 'ABOUT', url: '/about', has_dropdown: true, subitems: [] },
  { id: 5, label: 'LEARN', url: '#', has_dropdown: true, subitems: [] },
  { id: 6, label: 'CONTACT', url: '/', has_dropdown: false, subitems: [] },
];

function mergeHeader(data: Partial<HeaderData>): HeaderData {
  const result: HeaderData = { ...DEFAULT_HEADER };
  for (const key of Object.keys(DEFAULT_HEADER) as Array<keyof HeaderData>) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
  }
  return result;
}

export async function getHeader(): Promise<HeaderData> {
  try {
    const data = await directusGet<Partial<HeaderData> | null>('/items/header');
    if (!data) return { ...DEFAULT_HEADER };
    return mergeHeader(data);
  } catch {
    return { ...DEFAULT_HEADER };
  }
}

export async function getNavItems(): Promise<NavItem[]> {
  try {
    const [items, subs] = await Promise.all([
      directusGet<Array<Omit<NavItem, 'subitems'>>>(
        '/items/nav_items?filter[status][_eq]=published&sort=sort&limit=-1',
      ),
      directusGet<NavSubItem[]>(
        '/items/nav_subitems?filter[status][_eq]=published&sort=sort&limit=-1',
      ),
    ]);
    if (!Array.isArray(items) || items.length === 0) return DEFAULT_NAV;
    const subList = Array.isArray(subs) ? subs : [];
    // MySQL booleans come back as 0/1 — coerce; attach each item's children.
    return items.map((item) => ({
      ...item,
      has_dropdown: Boolean(item.has_dropdown),
      subitems: subList.filter((sub) => Number(sub.parent) === item.id),
    }));
  } catch {
    return DEFAULT_NAV;
  }
}

// ---------------------------------------------------------------------------
// Mega menu (flat collection) — multi-column categories with icons + links.
// Keyed by the top nav label (e.g. "SERVICES") so a nav item renders a mega
// panel instead of a simple dropdown when entries exist for it.
// ---------------------------------------------------------------------------

interface MegaMenuRow {
  menu: string;
  column: number;
  category: string;
  icon: string;
  image?: string | null;
  category_url?: string | null;
  label: string;
  url: string;
}

export interface MegaCategory {
  title: string;
  icon: string;
  image: string; // optional image path (e.g. /assets/menu/services/SEO.svg); takes priority over icon
  url: string; // optional link for the category heading / standalone item
  column: number;
  links: { label: string; url: string }[];
}

export async function getMegaMenus(): Promise<Record<string, MegaCategory[]>> {
  try {
    const rows = await directusGet<MegaMenuRow[]>(
      '/items/mega_menu?filter[status][_eq]=published&sort=column,sort&limit=-1',
    );
    if (!Array.isArray(rows)) return {};
    const result: Record<string, MegaCategory[]> = {};
    for (const row of rows) {
      const menu = (row.menu || '').trim() || 'SERVICES';
      if (!result[menu]) result[menu] = [];
      let cat = result[menu].find((c) => c.title === row.category && c.column === row.column);
      if (!cat) {
        cat = { title: row.category, icon: row.icon, image: (row.image || '').trim(), url: (row.category_url || '').trim(), column: row.column, links: [] };
        result[menu].push(cat);
      }
      // A row with an empty label is a standalone / header-only entry (no sub-link).
      if (row.label && row.label.trim() !== '') {
        cat.links.push({ label: row.label, url: row.url });
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Services promo (singleton) — the green "Experience Real Results" panel shown
// on the left of the SERVICES mega-menu. Fail-safe like the other singletons.
// ---------------------------------------------------------------------------

export interface ServicesPromo {
  enabled: boolean;
  heading: string;
  description: string;
  group_image: string;
  input_placeholder: string;
  button_text: string;
  button_url: string;
  phone_image: string;
  logo_image: string;
  stat1_value: string;
  stat1_label: string;
  stat2_value: string;
  stat2_label: string;
  stat3_value: string;
  stat3_label: string;
}

export const DEFAULT_SERVICES_PROMO: ServicesPromo = {
  enabled: true,
  heading: 'Experience Real Results',
  description: 'Partner with Thrive Internet Marketing Agency and scale your business.',
  group_image: '/assets/menu/services/resultgroup-image.png',
  input_placeholder: 'Enter Your Website Address',
  button_text: 'SEND MY FREE PROPOSAL',
  button_url: '/',
  phone_image: '/assets/menu/services/menu_smartphone_img01.png',
  logo_image: '/assets/menu/services/logo-1.svg',
  stat1_value: '+500%',
  stat1_label: 'Impressions',
  stat2_value: '+60%',
  stat2_label: 'New Followers',
  stat3_value: '+190%',
  stat3_label: 'Engagement',
};

export async function getServicesPromo(): Promise<ServicesPromo> {
  try {
    const data = await directusGet<Partial<ServicesPromo> | null>('/items/services_promo');
    if (!data) return { ...DEFAULT_SERVICES_PROMO };
    const result: ServicesPromo = { ...DEFAULT_SERVICES_PROMO };
    for (const key of Object.keys(DEFAULT_SERVICES_PROMO) as Array<keyof ServicesPromo>) {
      if (key === 'enabled') continue;
      const value = data[key];
      if (typeof value === 'string' && value.trim() !== '') (result[key] as string) = value;
    }
    // MySQL/Directus boolean comes back as 0/1 — coerce, defaulting to enabled.
    result.enabled = data.enabled === undefined || data.enabled === null ? true : Boolean(data.enabled);
    return result;
  } catch {
    return { ...DEFAULT_SERVICES_PROMO };
  }
}

// ---------------------------------------------------------------------------
// Result cards (e.g. the RESULTS menu) — image cards instead of link columns.
// Keyed by top nav label.
// ---------------------------------------------------------------------------

export interface ResultCard {
  title: string;
  subtitle: string;
  image_url: string;
  url: string;
}

export async function getResultCards(): Promise<Record<string, ResultCard[]>> {
  try {
    const rows = await directusGet<Array<ResultCard & { menu: string }>>(
      '/items/result_cards?filter[status][_eq]=published&sort=sort&limit=-1',
    );
    if (!Array.isArray(rows)) return {};
    const result: Record<string, ResultCard[]> = {};
    for (const row of rows) {
      const menu = (row.menu || '').trim() || 'RESULTS';
      if (!result[menu]) result[menu] = [];
      result[menu].push({ title: row.title, subtitle: row.subtitle || '', image_url: row.image_url, url: row.url });
    }
    return result;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Digital Marketing Services page — singleton `dms` (section text) + repeatable
// collections (cases, testimonials, tools, services, reasons, faqs). Fail-safe.
// ---------------------------------------------------------------------------

export interface DMS {
  seo_title: string; seo_description: string;
  hero_h1: string; hero_sub: string; hero_form_button: string;
  intro_h2: string; intro_body: string; intro_video_image: string; intro_cta_text: string; intro_cta_url: string;
  reviews_g_num: string; reviews_g_label: string; reviews_c_num: string; reviews_c_label: string; reviews_note: string;
  impact_h2: string; impact_sub: string; impact_body: string; impact_cta_text: string; impact_cta_url: string;
  how_h2: string; how_sub: string; how_body: string; how_list: string; how_body2: string;
  how_rank1: string; how_rank2: string; how_rank3: string; how_image: string;
  testi_h3: string; testi_sub: string; testi_cta_text: string; testi_cta_url: string;
  tools_h2: string; tools_sub: string; tools_body: string;
  services_h2: string; services_sub: string; services_cta_text: string; services_cta_url: string; services_cta2_text: string; services_cta2_url: string;
  whyuse_h2: string; whyuse_sub: string; whyuse_body: string; whyuse_list: string; whyuse_body2: string; whyuse_cta_text: string; whyuse_cta_url: string;
  whychoose_h2: string; whychoose_sub: string; whychoose_body: string; whychoose_cta_text: string; whychoose_cta_url: string;
  faqs_h2: string;
  cta_h2: string; cta_text: string; cta_btn1_text: string; cta_btn1_url: string; cta_btn2_text: string;
}

export async function getDMS(): Promise<DMS> {
  try {
    const data = await directusGet<DMS | null>('/items/dms');
    return data ?? ({} as DMS);
  } catch {
    return {} as DMS;
  }
}

export interface DmsCase { name: string; stat1_num: string; stat1_label: string; stat2_num: string; stat2_label: string; description: string; image: string; url: string; }
export interface DmsTestimonial { headline: string; quote: string; author: string; }
export interface DmsTool { title: string; description: string; image: string; }
export interface DmsService { title: string; description: string; image: string; url: string; }
export interface DmsReason { title: string; description: string; icon: string; }
export interface DmsFaq { question: string; answer: string; }

export const getDmsCases = () => getList<DmsCase>('dms_cases');
export const getDmsTestimonials = () => getList<DmsTestimonial>('dms_testimonials');
export const getDmsTools = () => getList<DmsTool>('dms_tools');
export const getDmsServices = () => getList<DmsService>('dms_services');
export const getDmsReasons = () => getList<DmsReason>('dms_reasons');
export const getDmsFaqs = () => getList<DmsFaq>('dms_faqs');

// ---------------------------------------------------------------------------
// Digital Marketing Strategy Development page — singleton `dms_strategy`.
// Content-heavy sub-service page; follows the same pattern as `dms` (content
// lives in Directus, returns {} when unreachable so the page never crashes).
// Repeating groups are stored as newline-separated, "|"-delimited rows
// (same convention as home_wins.stat1) and parsed in the .astro page.
// ---------------------------------------------------------------------------

export interface DMSStrategy {
  seo_title: string; seo_description: string;
  hero_h1: string; hero_sub: string; hero_form_button: string;
  intro_h2: string; intro_sub: string; intro_body: string;
  why_eyebrow: string; why_h2: string; why_body: string;
  allows_title: string; allows_list: string;   // newline bullets
  fail_title: string; fail_list: string;        // newline bullets
  guide_h2: string; guide_sub: string; cta_band_text: string; cta_band_url: string;
  approach_eyebrow: string; approach_h2: string; approach_body: string;
  approach_items: string;                        // "Title | Description" per line
  industry_eyebrow: string; industry_h2: string; industry_body: string;
  industry_items: string; industry_footer: string; // "Title | Description" per line
  included_eyebrow: string; included_h2: string; included_body: string;
  included_s1_title: string; included_s1_list: string;
  included_s2_title: string; included_s2_list: string;
  included_s3_title: string; included_s3_list: string;
  case_eyebrow: string; case_h2: string; case_body: string; case_label: string; case_desc: string;
  case_stat1_num: string; case_stat1_label: string;
  case_stat2_num: string; case_stat2_label: string;
  case_stat3_num: string; case_stat3_label: string;
  focus_pre_h2: string; focus_eyebrow: string; focus_h2: string; focus_body: string;
  focus_items: string; focus_footer: string;     // "Title | Description" per line
  formula_eyebrow: string; formula_h2: string; formula_body: string;
  formula_items: string;                          // "Title | Description" per line
  services_eyebrow: string; services_h2: string; services_body: string;
  services_items: string;                         // one title per line
  process_eyebrow: string; process_h2: string; process_body: string; process_footer: string;
  phases_items: string;                           // "Phase | Subtitle | Description" per line
  whychoose_eyebrow: string; whychoose_h2: string; whychoose_body: string;
  reasons_items: string;                          // "Title | Description" per line
  faqs_h2: string; faqs_items: string;            // "Question | Answer" per line
  cta_h2: string; cta_text: string; cta_btn1_text: string; cta_btn1_url: string; cta_btn2_text: string;
}

export async function getDMSStrategy(): Promise<DMSStrategy> {
  try {
    const data = await directusGet<DMSStrategy | null>('/items/dms_strategy');
    return data ?? ({} as DMSStrategy);
  } catch {
    return {} as DMSStrategy;
  }
}
