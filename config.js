// ==============================================================
//  CONFIGURATION — à remplir une seule fois (voir LISEZMOI.md)
// ==============================================================
// Tant que ces valeurs ne sont pas remplies, l'app fonctionne en
// « mode démo » : les données restent seulement sur l'appareil.

window.APP_CONFIG = {
  // Supabase > Project Settings > API > Project URL
  supabaseUrl: "https://VOTRE-PROJET.supabase.co",

  // Supabase > Project Settings > API > anon public key
  supabaseAnonKey: "VOTRE-CLE-ANON",

  // Le courriel du compte d'équipe créé dans Supabase > Authentication > Users.
  // Les utilisateurs de l'app n'ont jamais à le taper : seulement le mot de passe.
  teamEmail: "equipe@exemple.com",

  // Nom affiché sur la page d'accueil et dans les rapports
  teamName: "Mon équipe"
};
