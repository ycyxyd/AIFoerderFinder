// ============================================================================
// Core domain types — FörderFinder (compliance-first architecture)
// Layer separation (NON-NEGOTIABLE):
//   Facts     (user_profiles)          -> structured, authoritative
//   Decisions (eligibility_decisions)  -> immutable snapshots
//   Chat      (chat_messages)          -> language continuity ONLY
// The AI NEVER produces a DecisionSnapshot. It only EXPLAINS one.
// ============================================================================

export type EmploymentStatus =
  | 'employed'
  | 'self_employed'
  | 'freelancer'
  | 'unemployed'
  | 'student'
  | 'retired'
  | 'homemaker'
  | 'other';

export interface UserProfile {
  user_id?: string;
  birth_year?: number;
  age?: number;
  residence_city?: string;
  residence_plz?: string;
  employment_status?: EmploymentStatus;
  /** Netto-Monatseinkommen in EUR */
  monthly_income?: number;
  /** Gesamtvermögen in EUR (Bank, Wertpapiere, ...) */
  assets_total?: number;
  has_car?: boolean;
  has_property?: boolean;
  children?: number;
  /** Pflichtversicherungsmonate innerhalb der letzten 30 Monate (ALG I) */
  insurance_months?: number;
  single_parent?: boolean;
  student?: boolean;
  in_vocational_training?: boolean;
  receives_buergergeld?: boolean;
  receives_alg1?: boolean;
  starting_self_employment?: boolean;
  business_registered?: boolean;
  business_plan?: boolean;
  newborn_child?: boolean;
  pflegegrad?: number;
  working_hours_reduced?: boolean;
  employer_insolvent?: boolean;
  heating_cost_high?: boolean;
  [key: string]: unknown; // forward-compatible extension fields
}

// ----------------------------------------------------------------------------
// DSL — Domain Specific Language for eligibility rules
// ----------------------------------------------------------------------------

export interface Condition {
  /**
   * Per-field condition. Either an operator object, e.g.
   *   { insurance_months: { gte: 12 } }
   * or a literal shorthand for equality, e.g.
   *   { employment_status: 'unemployed' }   (== eq)
   */
  [field: string]:
    | {
        gte?: number;
        gt?: number;
        lte?: number;
        lt?: number;
        eq?: unknown;
        neq?: unknown;
        contains?: unknown[];
        in?: unknown[];
      }
    | number
    | string
    | boolean;
}

export interface Rule {
  if: Condition;
  then: {
    eligible?: boolean;
    /** reason_code, e.g. 'INSURANCE_MONTHS_LT_12' */
    reason?: string;
    /** alternative funding ids, e.g. ['buergergeld'] */
    alternative?: string[];
    /** risk_code, e.g. 'ASSET_LIMIT_EXCEEDED' */
    risk?: string;
    message_key?: string;
  };
}

export interface FundingSchema {
  id: string;
  name: string;
  category: string;
  provider: string;
  description?: string;
  target_group?: string[];
  eligibility_rules: Rule[];
  exclusion_rules: Rule[];
  risk_rules: Rule[];
  benefits?: { type: string; description?: string };
  application?: {
    authority: string;
    online?: boolean;
    offline?: boolean;
    links?: string[];
  };
  documents_required?: string[];
  steps?: {
    step_id: string;
    title: string;
    when?: string;
    explain?: string;
    risk_if_missed?: string;
  }[];
  notes?: string[];
  valid_from?: string;
  valid_until?: string;
  last_verified?: string;
  sources?: string[];
}

export type DecisionStatus = 'eligible' | 'not_eligible' | 'unclear';

export interface ReasonCode {
  code: string;
  explanation?: string;
}

export interface RiskFlag {
  risk_code: string;
  message_key?: string;
  description?: string;
}

export interface DecisionSnapshot {
  decision_id: string;
  user_id?: string;
  funding_id: string;
  funding_name: string;
  provider: string;
  status: DecisionStatus;
  reason_codes: ReasonCode[];
  risks: RiskFlag[];
  alternatives: string[];
  official_links: string[];
  created_at: string;
  valid_until: string;
}

// ----------------------------------------------------------------------------
// Intent detection / guardrails
// ----------------------------------------------------------------------------

export type IntentType =
  | 'GUARANTEE_REQUEST'
  | 'LEGAL_ACTION'
  | 'RULE_CIRCUMVENTION'
  | 'PROMPT_INJECTION'
  | 'NORMAL_INFORMATION';

export interface IntentResult {
  type: IntentType;
  matchedKeyword?: string;
}

export interface AuditEntry {
  event_type: string;
  user_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
}
