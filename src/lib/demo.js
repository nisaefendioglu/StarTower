import { rng } from './random.js';
import { shapeTower } from './shape.js';

const REPOS = [
  ['flutter-habit-tracker', 'Habit tracker built with Riverpod and Hive', 'Dart', 48],
  ['erp-mobile-kit', 'Offline-first ERP form widgets for field teams', 'Dart', 31],
  ['kotlin-weather', 'A minimal weather app in Jetpack Compose', 'Kotlin', 22],
  ['react-kanban', 'A tiny drag-and-drop Kanban board', 'JavaScript', 17],
  ['mysql-backup-cli', 'CLI for scheduled MySQL backups', 'Shell', 12],
  ['dart-validators', 'Phone, IBAN and postcode validation helpers', 'Dart', 9],
  ['portfolio-site', 'Personal portfolio site', 'HTML', 5],
  ['campus-events', 'Graduation project: a campus events app', 'Dart', 4],
  ['algorithms-notes', 'Data structures and algorithms study notes', 'Python', 0],
  ['dotfiles', 'My terminal and editor setup', 'Shell', 0],
  ['flutter-playground', 'Widget experiments', 'Dart', 0],
];

// Örnek kullanıcılar: GitHub adlarında '_' olamayacağı için gerçek hesaplarla karışmaz
const LOGINS = 'selin_yilmaz kodcu_baris ayse_dev emre_akin zeynep_k burak_tr elif_codes can_ozturk melis_ui onur_dev gizem_js kerem_flutter ipek_ml tolga_backend nazli_kt arda_oss sevval_data umut_go ece_design hakan_rust yagmur_ai bora_sec defne_web alp_devops irem_qa serkan_k cansu_m efe_games pinar_cloud oguz_api mert_sh duru_app kaan_ops lale_ux berk_cpp asli_r tuna_swift sena_vue okan_db nil_test ege_node sude_kt cem_linux aylin_py'.split(' ');

export function demoTower() {
  const r = rng(42);
  const starredNames = REPOS.filter((x) => x[3] > 0).map((x) => x[0]);
  // Repo yıldız sayıları gerçek dağılıma benzesin diye ağırlıklı seçim
  const weight = Object.fromEntries(REPOS.map((x) => [x[0], x[3]]));
  const gazers = LOGINS.map((login, i) => {
    const k = Math.max(1, Math.min(starredNames.length, Math.round(7.4 * Math.exp(-i / 8) + r() * 1.2)));
    const picks = starredNames
      .map((n) => ({ n, s: r() * weight[n] }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((x) => x.n);
    return { login, avatar: null, url: null, repos: picks };
  });
  const counts = {};
  gazers.forEach((g) => g.repos.forEach((n) => (counts[n] = (counts[n] || 0) + 1)));
  const repos = REPOS.map(([name, desc, lang]) => ({ name, desc, lang, stars: counts[name] || 0, url: null, scanned: true }));
  return shapeTower({ owner: 'sample_dev', repos, gazers, scanned: starredNames.length, isDemo: true });
}
