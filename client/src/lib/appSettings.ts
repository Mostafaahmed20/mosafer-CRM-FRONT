export type DuplicateMode = "block" | "warn";

export type CustomerRulesSettings = {
  duplicateMode: DuplicateMode;
  requireEmail: boolean;
  requireLocation: boolean;
  requireDecisionRole: boolean;
  adminOnlyEdit: boolean;
  adminOnlyDelete: boolean;
};

export type AppSettings = {
  customerRules: CustomerRulesSettings;
};

const SETTINGS_KEY = "crm_app_settings_v1";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  customerRules: {
    duplicateMode: "block",
    requireEmail: true,
    requireLocation: true,
    requireDecisionRole: true,
    adminOnlyEdit: true,
    adminOnlyDelete: true,
  },
};

export function getAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      customerRules: {
        ...DEFAULT_APP_SETTINGS.customerRules,
        ...(parsed?.customerRules || {}),
      },
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
