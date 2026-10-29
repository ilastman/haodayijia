/* ============================================================
 * 员工工作台 · 演示种子补充
 * 在 data.js 之后、store.js 之前加载：为 window.SEED 补齐新集合，
 * 避免 store 初始化时集合缺位（云端登录后会被真实数据覆盖）。
 * ============================================================ */
(function () {
  window.SEED = window.SEED || {};
  if (!Array.isArray(window.SEED.staff)) window.SEED.staff = [];
  if (!Array.isArray(window.SEED.order)) window.SEED.order = [];
  if (!Array.isArray(window.SEED.opLog)) window.SEED.opLog = [];
  if (!Array.isArray(window.SEED.user)) window.SEED.user = [];
})();
