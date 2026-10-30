// Built-in study topics: the human body, system by system, in each language.
import { getLang } from './i18n.js';

const BASE = [
  { id: 'skeletal', icon: '🦴', color: '#c9a86a' },
  { id: 'muscular', icon: '💪', color: '#d9534f' },
  { id: 'circulatory', icon: '❤️', color: '#e0245e' },
  { id: 'respiratory', icon: '🫁', color: '#5bc0de' },
  { id: 'digestive', icon: '🍎', color: '#f0ad4e' },
  { id: 'nervous', icon: '🧠', color: '#9b59b6' },
  { id: 'endocrine', icon: '⚗️', color: '#16a085' },
  { id: 'immune', icon: '🛡️', color: '#27ae60' },
  { id: 'urinary', icon: '💧', color: '#3498db' },
  { id: 'integumentary', icon: '🖐️', color: '#e67e22' },
  { id: 'reproductive', icon: '🧬', color: '#c0392b' },
  { id: 'cells', icon: '🔬', color: '#7f8c8d' },
];
const GENERAL_BASE = { id: 'general', icon: '💬', color: '#5865f2' };

const TEXT = {
  en: {
    skeletal: {
      name: 'Skeletal System',
      overview: 'The skeleton gives the body its shape, protects soft organs, and works with muscles to make movement possible. Bones also store calcium and phosphate, and red bone marrow makes blood cells.',
      parts: ['Bones (206 in adults)', 'Cartilage', 'Ligaments', 'Joints', 'Bone marrow'],
      facts: ['The femur (thigh bone) is the longest and strongest bone.', 'Babies are born with about 270 bones; many fuse as they grow.', 'Bone is living tissue that is constantly broken down and rebuilt.'],
    },
    muscular: {
      name: 'Muscular System',
      overview: 'Muscles contract to move the body, pump blood, and push food through the gut. There are three types: skeletal (voluntary), smooth (in organ walls), and cardiac (heart only).',
      parts: ['Skeletal muscle', 'Smooth muscle', 'Cardiac muscle', 'Tendons'],
      facts: ['Muscles can only pull, never push — they work in opposing pairs.', 'Muscle contraction produces much of the body’s heat.', 'Tendons connect muscle to bone; ligaments connect bone to bone.'],
    },
    circulatory: {
      name: 'Circulatory System',
      overview: 'The heart pumps blood through arteries, capillaries, and veins to deliver oxygen and nutrients and carry away carbon dioxide and wastes. It has two loops: pulmonary (to the lungs) and systemic (to the body).',
      parts: ['Heart (4 chambers)', 'Arteries', 'Veins', 'Capillaries', 'Blood'],
      facts: ['Arteries carry blood away from the heart; veins carry it back.', 'Red blood cells use hemoglobin to carry oxygen.', 'Exchange with tissues happens across thin capillary walls.'],
    },
    respiratory: {
      name: 'Respiratory System',
      overview: 'Breathing brings oxygen into the lungs and removes carbon dioxide. Gas exchange happens in tiny air sacs called alveoli, which are wrapped in capillaries.',
      parts: ['Nose & pharynx', 'Larynx', 'Trachea', 'Bronchi & bronchioles', 'Alveoli', 'Diaphragm'],
      facts: ['The diaphragm contracts and moves down to pull air in.', 'Breathing rate is mainly driven by CO₂ levels in the blood.', 'Alveoli give the lungs a huge surface area for diffusion.'],
    },
    digestive: {
      name: 'Digestive System',
      overview: 'The digestive system breaks food down mechanically and chemically into molecules small enough to absorb. Most absorption happens in the small intestine; the large intestine absorbs water.',
      parts: ['Mouth & salivary glands', 'Esophagus', 'Stomach', 'Small intestine', 'Large intestine', 'Liver, gallbladder, pancreas'],
      facts: ['Enzymes speed up the breakdown of carbohydrates, proteins, and fats.', 'Villi and microvilli increase the small intestine’s surface area.', 'Bile from the liver emulsifies fats.'],
    },
    nervous: {
      name: 'Nervous System',
      overview: 'The nervous system senses changes, processes information, and sends fast electrical signals to control the body. It is divided into the central nervous system (brain and spinal cord) and the peripheral nervous system.',
      parts: ['Brain', 'Spinal cord', 'Nerves', 'Neurons', 'Synapses', 'Sense organs'],
      facts: ['Neurons communicate across synapses using neurotransmitters.', 'Reflexes can be handled by the spinal cord without the brain.', 'The autonomic system controls things you don’t consciously control, like heart rate.'],
    },
    endocrine: {
      name: 'Endocrine System',
      overview: 'Endocrine glands release hormones into the blood to regulate growth, metabolism, reproduction, and balance (homeostasis). Hormone effects are slower but longer-lasting than nerve signals.',
      parts: ['Hypothalamus & pituitary', 'Thyroid', 'Adrenal glands', 'Pancreas (islets)', 'Ovaries / testes'],
      facts: ['Insulin lowers blood glucose; glucagon raises it.', 'Many hormone levels are controlled by negative feedback.', 'The pituitary is often called the “master gland”.'],
    },
    immune: {
      name: 'Immune & Lymphatic',
      overview: 'The immune system defends against pathogens. Innate immunity responds fast and generally; adaptive immunity (B and T cells) is specific and has memory. The lymphatic system returns fluid to the blood and hosts immune cells.',
      parts: ['White blood cells', 'Lymph nodes', 'Spleen', 'Thymus', 'Antibodies'],
      facts: ['Vaccines train adaptive immunity by creating memory cells.', 'B cells make antibodies; T cells help coordinate or kill infected cells.', 'Skin and mucus are part of the first line of defense.'],
    },
    urinary: {
      name: 'Urinary System',
      overview: 'The kidneys filter blood to remove wastes like urea and to balance water, salts, and pH. Urine flows through the ureters to the bladder and leaves through the urethra.',
      parts: ['Kidneys', 'Nephrons', 'Ureters', 'Bladder', 'Urethra'],
      facts: ['Each kidney contains around a million nephrons.', 'ADH hormone tells the kidneys to save more water.', 'The kidneys filter roughly 180 liters of blood plasma a day.'],
    },
    integumentary: {
      name: 'Skin (Integumentary)',
      overview: 'Skin, hair, and nails form a protective barrier against injury, water loss, and germs. Skin also helps control body temperature, senses touch, and makes vitamin D in sunlight.',
      parts: ['Epidermis', 'Dermis', 'Hypodermis', 'Sweat glands', 'Hair & nails'],
      facts: ['Skin is the body’s largest organ.', 'Sweating cools the body as the water evaporates.', 'Melanin pigment helps protect against UV light.'],
    },
    reproductive: {
      name: 'Reproductive System',
      overview: 'The reproductive system produces sex cells (gametes) and hormones, and makes reproduction possible. Its development and activity are controlled by hormones from the pituitary and gonads.',
      parts: ['Gonads (ovaries / testes)', 'Gametes (egg / sperm)', 'Uterus', 'Sex hormones'],
      facts: ['Gametes are made by meiosis and carry half the chromosomes.', 'Fertilization combines two gametes into a zygote.', 'Estrogen, progesterone, and testosterone are key sex hormones.'],
    },
    cells: {
      name: 'Cells & Tissues',
      overview: 'Cells are the basic units of life. Similar cells form tissues (epithelial, connective, muscle, nervous), tissues form organs, and organs work together in systems.',
      parts: ['Cell membrane', 'Nucleus', 'Mitochondria', 'Epithelial tissue', 'Connective tissue'],
      facts: ['Mitochondria release energy from glucose in cellular respiration.', 'DNA in the nucleus holds the instructions for making proteins.', 'Levels: cell → tissue → organ → system → organism.'],
    },
    general: {
      name: 'Ask Anything',
      overview: 'Ask any question about the human body — how systems connect, exam questions, or things you’re curious about.',
      parts: [], facts: [],
    },
  },

  'zh-Hant': {
    skeletal: {
      name: '骨骼系統',
      overview: '骨骼撐起身體的形狀、保護柔軟的器官，並和肌肉合作讓身體能夠活動。骨頭也儲存鈣和磷，紅骨髓則負責製造血球。',
      parts: ['骨頭（成人 206 塊）', '軟骨', '韌帶', '關節', '骨髓'],
      facts: ['股骨（大腿骨）是全身最長、最強壯的骨頭。', '嬰兒出生時約有 270 塊骨頭，成長過程中許多會癒合在一起。', '骨頭是活的組織，會不斷被分解再重建。'],
    },
    muscular: {
      name: '肌肉系統',
      overview: '肌肉靠收縮來移動身體、推動血液，以及把食物推過消化道。肌肉分成三種：骨骼肌（隨意肌）、平滑肌（在器官壁上）和心肌（只在心臟）。',
      parts: ['骨骼肌', '平滑肌', '心肌', '肌腱'],
      facts: ['肌肉只能「拉」不能「推」，所以會兩兩成對、互相拮抗。', '肌肉收縮會產生身體大部分的熱量。', '肌腱連接肌肉和骨頭；韌帶連接骨頭和骨頭。'],
    },
    circulatory: {
      name: '循環系統',
      overview: '心臟把血液打進動脈、微血管和靜脈，運送氧氣和養分，並帶走二氧化碳和廢物。血液循環分成兩條路線：肺循環（到肺）和體循環（到全身）。',
      parts: ['心臟（四個腔室）', '動脈', '靜脈', '微血管', '血液'],
      facts: ['動脈把血液帶離心臟，靜脈把血液送回心臟。', '紅血球靠血紅素攜帶氧氣。', '血液和組織之間的物質交換，發生在很薄的微血管壁。'],
    },
    respiratory: {
      name: '呼吸系統',
      overview: '呼吸把氧氣帶進肺部，並排出二氧化碳。氣體交換發生在叫做肺泡的小氣囊，肺泡外面包著微血管。',
      parts: ['鼻腔與咽', '喉', '氣管', '支氣管與細支氣管', '肺泡', '橫膈膜'],
      facts: ['橫膈膜收縮並往下移動時，空氣就會被吸進來。', '呼吸的快慢主要由血液中的二氧化碳濃度決定。', '肺泡讓肺有非常大的表面積來進行擴散。'],
    },
    digestive: {
      name: '消化系統',
      overview: '消化系統用物理和化學的方式，把食物分解成小到可以吸收的分子。大部分的吸收發生在小腸，大腸則負責吸收水分。',
      parts: ['口腔與唾液腺', '食道', '胃', '小腸', '大腸', '肝臟、膽囊、胰臟'],
      facts: ['酵素能加快醣類、蛋白質和脂肪的分解。', '絨毛和微絨毛增加了小腸的表面積。', '肝臟製造的膽汁能乳化脂肪。'],
    },
    nervous: {
      name: '神經系統',
      overview: '神經系統偵測變化、處理訊息，並傳送快速的電訊號來控制身體。它分成中樞神經系統（腦和脊髓）和周圍神經系統。',
      parts: ['腦', '脊髓', '神經', '神經元', '突觸', '感覺器官'],
      facts: ['神經元之間靠神經傳導物質在突觸傳遞訊息。', '反射可以由脊髓直接處理，不需要經過大腦。', '自律神經系統控制你無法自主控制的事，例如心跳。'],
    },
    endocrine: {
      name: '內分泌系統',
      overview: '內分泌腺把激素（荷爾蒙）釋放到血液中，調節生長、代謝、生殖和體內平衡（恆定性）。激素的作用比神經訊號慢，但持續比較久。',
      parts: ['下視丘與腦下垂體', '甲狀腺', '腎上腺', '胰臟（胰島）', '卵巢／睪丸'],
      facts: ['胰島素讓血糖下降，升糖素讓血糖上升。', '許多激素的濃度是靠負回饋來控制。', '腦下垂體常被稱為「內分泌腺的主宰」。'],
    },
    immune: {
      name: '免疫與淋巴系統',
      overview: '免疫系統負責抵抗病原體。先天性免疫反應快、不具專一性；後天性免疫（B 細胞和 T 細胞）具有專一性和記憶性。淋巴系統把組織液送回血液，也是免疫細胞的據點。',
      parts: ['白血球', '淋巴結', '脾臟', '胸腺', '抗體'],
      facts: ['疫苗透過產生記憶細胞來訓練後天性免疫。', 'B 細胞製造抗體；T 細胞協調免疫反應或殺死被感染的細胞。', '皮膚和黏液是身體的第一道防線。'],
    },
    urinary: {
      name: '泌尿系統',
      overview: '腎臟過濾血液，排除尿素等廢物，並調節水分、鹽類和酸鹼值。尿液經由輸尿管流到膀胱，再從尿道排出。',
      parts: ['腎臟', '腎元', '輸尿管', '膀胱', '尿道'],
      facts: ['每顆腎臟大約有一百萬個腎元。', '抗利尿激素（ADH）會讓腎臟保留更多水分。', '腎臟每天大約過濾 180 公升的血漿。'],
    },
    integumentary: {
      name: '皮膚系統',
      overview: '皮膚、毛髮和指甲形成保護屏障，防止受傷、水分流失和病菌入侵。皮膚也幫忙調節體溫、感覺觸碰，並在陽光下製造維生素 D。',
      parts: ['表皮', '真皮', '皮下組織', '汗腺', '毛髮與指甲'],
      facts: ['皮膚是人體最大的器官。', '流汗時，水分蒸發會帶走熱量讓身體降溫。', '黑色素能幫忙抵擋紫外線。'],
    },
    reproductive: {
      name: '生殖系統',
      overview: '生殖系統製造生殖細胞（配子）和性激素，讓生殖成為可能。它的發育和運作受到腦下垂體和性腺所分泌的激素控制。',
      parts: ['性腺（卵巢／睪丸）', '配子（卵子／精子）', '子宮', '性激素'],
      facts: ['配子由減數分裂產生，只帶有一半的染色體。', '受精是兩個配子結合成受精卵。', '雌激素、黃體素和睪固酮是主要的性激素。'],
    },
    cells: {
      name: '細胞與組織',
      overview: '細胞是生命的基本單位。相似的細胞組成組織（上皮、結締、肌肉、神經組織），組織組成器官，器官再一起構成系統。',
      parts: ['細胞膜', '細胞核', '粒線體', '上皮組織', '結締組織'],
      facts: ['粒線體透過細胞呼吸，從葡萄糖中釋放能量。', '細胞核中的 DNA 帶有製造蛋白質的指令。', '層次：細胞 → 組織 → 器官 → 系統 → 個體。'],
    },
    general: {
      name: '自由發問',
      overview: '問任何關於人體的問題：系統之間怎麼連結、考試題目，或任何你好奇的事。',
      parts: [], facts: [],
    },
  },
};

function localize(base) {
  return { ...base, ...TEXT[getLang()][base.id] };
}

export function topics() {
  return BASE.map(localize);
}

export function generalTopic() {
  return localize(GENERAL_BASE);
}

export function getTopic(id) {
  const base = BASE.find((t) => t.id === id) || (id === GENERAL_BASE.id ? GENERAL_BASE : null);
  return base && localize(base);
}
