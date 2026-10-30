// Built-in study topics: the human body, system by system.
export const TOPICS = [
  {
    id: 'skeletal', name: 'Skeletal System', icon: '🦴', color: '#c9a86a',
    overview: 'The skeleton gives the body its shape, protects soft organs, and works with muscles to make movement possible. Bones also store calcium and phosphate, and red bone marrow makes blood cells.',
    parts: ['Bones (206 in adults)', 'Cartilage', 'Ligaments', 'Joints', 'Bone marrow'],
    facts: ['The femur (thigh bone) is the longest and strongest bone.', 'Babies are born with about 270 bones; many fuse as they grow.', 'Bone is living tissue that is constantly broken down and rebuilt.'],
  },
  {
    id: 'muscular', name: 'Muscular System', icon: '💪', color: '#d9534f',
    overview: 'Muscles contract to move the body, pump blood, and push food through the gut. There are three types: skeletal (voluntary), smooth (in organ walls), and cardiac (heart only).',
    parts: ['Skeletal muscle', 'Smooth muscle', 'Cardiac muscle', 'Tendons'],
    facts: ['Muscles can only pull, never push — they work in opposing pairs.', 'Muscle contraction produces much of the body’s heat.', 'Tendons connect muscle to bone; ligaments connect bone to bone.'],
  },
  {
    id: 'circulatory', name: 'Circulatory System', icon: '❤️', color: '#e0245e',
    overview: 'The heart pumps blood through arteries, capillaries, and veins to deliver oxygen and nutrients and carry away carbon dioxide and wastes. It has two loops: pulmonary (to the lungs) and systemic (to the body).',
    parts: ['Heart (4 chambers)', 'Arteries', 'Veins', 'Capillaries', 'Blood'],
    facts: ['Arteries carry blood away from the heart; veins carry it back.', 'Red blood cells use hemoglobin to carry oxygen.', 'Exchange with tissues happens across thin capillary walls.'],
  },
  {
    id: 'respiratory', name: 'Respiratory System', icon: '🫁', color: '#5bc0de',
    overview: 'Breathing brings oxygen into the lungs and removes carbon dioxide. Gas exchange happens in tiny air sacs called alveoli, which are wrapped in capillaries.',
    parts: ['Nose & pharynx', 'Larynx', 'Trachea', 'Bronchi & bronchioles', 'Alveoli', 'Diaphragm'],
    facts: ['The diaphragm contracts and moves down to pull air in.', 'Breathing rate is mainly driven by CO₂ levels in the blood.', 'Alveoli give the lungs a huge surface area for diffusion.'],
  },
  {
    id: 'digestive', name: 'Digestive System', icon: '🍎', color: '#f0ad4e',
    overview: 'The digestive system breaks food down mechanically and chemically into molecules small enough to absorb. Most absorption happens in the small intestine; the large intestine absorbs water.',
    parts: ['Mouth & salivary glands', 'Esophagus', 'Stomach', 'Small intestine', 'Large intestine', 'Liver, gallbladder, pancreas'],
    facts: ['Enzymes speed up the breakdown of carbohydrates, proteins, and fats.', 'Villi and microvilli increase the small intestine’s surface area.', 'Bile from the liver emulsifies fats.'],
  },
  {
    id: 'nervous', name: 'Nervous System', icon: '🧠', color: '#9b59b6',
    overview: 'The nervous system senses changes, processes information, and sends fast electrical signals to control the body. It is divided into the central nervous system (brain and spinal cord) and the peripheral nervous system.',
    parts: ['Brain', 'Spinal cord', 'Nerves', 'Neurons', 'Synapses', 'Sense organs'],
    facts: ['Neurons communicate across synapses using neurotransmitters.', 'Reflexes can be handled by the spinal cord without the brain.', 'The autonomic system controls things you don’t consciously control, like heart rate.'],
  },
  {
    id: 'endocrine', name: 'Endocrine System', icon: '⚗️', color: '#16a085',
    overview: 'Endocrine glands release hormones into the blood to regulate growth, metabolism, reproduction, and balance (homeostasis). Hormone effects are slower but longer-lasting than nerve signals.',
    parts: ['Hypothalamus & pituitary', 'Thyroid', 'Adrenal glands', 'Pancreas (islets)', 'Ovaries / testes'],
    facts: ['Insulin lowers blood glucose; glucagon raises it.', 'Many hormone levels are controlled by negative feedback.', 'The pituitary is often called the “master gland”.'],
  },
  {
    id: 'immune', name: 'Immune & Lymphatic', icon: '🛡️', color: '#27ae60',
    overview: 'The immune system defends against pathogens. Innate immunity responds fast and generally; adaptive immunity (B and T cells) is specific and has memory. The lymphatic system returns fluid to the blood and hosts immune cells.',
    parts: ['White blood cells', 'Lymph nodes', 'Spleen', 'Thymus', 'Antibodies'],
    facts: ['Vaccines train adaptive immunity by creating memory cells.', 'B cells make antibodies; T cells help coordinate or kill infected cells.', 'Skin and mucus are part of the first line of defense.'],
  },
  {
    id: 'urinary', name: 'Urinary System', icon: '💧', color: '#3498db',
    overview: 'The kidneys filter blood to remove wastes like urea and to balance water, salts, and pH. Urine flows through the ureters to the bladder and leaves through the urethra.',
    parts: ['Kidneys', 'Nephrons', 'Ureters', 'Bladder', 'Urethra'],
    facts: ['Each kidney contains around a million nephrons.', 'ADH hormone tells the kidneys to save more water.', 'The kidneys filter roughly 180 liters of blood plasma a day.'],
  },
  {
    id: 'integumentary', name: 'Skin (Integumentary)', icon: '🖐️', color: '#e67e22',
    overview: 'Skin, hair, and nails form a protective barrier against injury, water loss, and germs. Skin also helps control body temperature, senses touch, and makes vitamin D in sunlight.',
    parts: ['Epidermis', 'Dermis', 'Hypodermis', 'Sweat glands', 'Hair & nails'],
    facts: ['Skin is the body’s largest organ.', 'Sweating cools the body as the water evaporates.', 'Melanin pigment helps protect against UV light.'],
  },
  {
    id: 'reproductive', name: 'Reproductive System', icon: '🧬', color: '#c0392b',
    overview: 'The reproductive system produces sex cells (gametes) and hormones, and makes reproduction possible. Its development and activity are controlled by hormones from the pituitary and gonads.',
    parts: ['Gonads (ovaries / testes)', 'Gametes (egg / sperm)', 'Uterus', 'Sex hormones'],
    facts: ['Gametes are made by meiosis and carry half the chromosomes.', 'Fertilization combines two gametes into a zygote.', 'Estrogen, progesterone, and testosterone are key sex hormones.'],
  },
  {
    id: 'cells', name: 'Cells & Tissues', icon: '🔬', color: '#7f8c8d',
    overview: 'Cells are the basic units of life. Similar cells form tissues (epithelial, connective, muscle, nervous), tissues form organs, and organs work together in systems.',
    parts: ['Cell membrane', 'Nucleus', 'Mitochondria', 'Epithelial tissue', 'Connective tissue'],
    facts: ['Mitochondria release energy from glucose in cellular respiration.', 'DNA in the nucleus holds the instructions for making proteins.', 'Levels: cell → tissue → organ → system → organism.'],
  },
];

export const GENERAL = {
  id: 'general', name: 'Ask Anything', icon: '💬', color: '#5865f2',
  overview: 'Ask any question about the human body — how systems connect, exam questions, or things you’re curious about.',
  parts: [], facts: [],
};

export function getTopic(id) {
  return TOPICS.find((t) => t.id === id) || (id === GENERAL.id ? GENERAL : null);
}
