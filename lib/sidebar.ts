export const SIDEBAR_STORAGE_KEY = "voom:sidebar";

// Runs before paint so the collapsed sidebar renders at its final width
// instead of snapping after hydration.
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)})==="collapsed"){document.documentElement.dataset.voomSidebar="collapsed"}}catch(e){}`;
