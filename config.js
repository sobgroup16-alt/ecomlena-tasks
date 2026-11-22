/* Подключение к Supabase. Здесь только публичный (publishable) ключ:
   он предназначен для браузера, данные защищены правилами RLS.
   Секретный service_role ключ сюда класть нельзя. */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://uzuatbxiauipljfdiuhj.supabase.co',
  SUPABASE_KEY: 'sb_publishable_BvGlyaQOUCfuifpZ1wIgIw_ul3Vo_oI',
};
