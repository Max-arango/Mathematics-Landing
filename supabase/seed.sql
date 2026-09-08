-- ============================================================================
--  Mathematics Simulator - future Supabase data layer (seed.sql)
-- ============================================================================
--
--  Generated for Mathematics Simulator — future Supabase integration.
--  Landing currently runs without any backend.
--
--  SAFE TO RUN AFTER schema.sql.
--    - Seeds metadata + demo content only:
--        * workspace_metadata : the 9 workspaces
--        * examples           : 6 curated gallery examples (no owner)
--        * tags               : 8 topical tags
--    - NO user data is seeded: profiles, projects, experiments, notebooks
--      and the join tables stay empty on purpose (no fake users).
--    - IDEMPOTENT: every insert uses ON CONFLICT DO NOTHING, so re-running
--      never duplicates rows and never clobbers rows edited by hand.
--      workspace_metadata and tags each have two unique constraints
--      (workspace/sort_order and name/slug), so a bare ON CONFLICT DO
--      NOTHING (no conflict target) is used there to cover both.
--
--  Not applied anywhere yet; the landing reads local mock data only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) The 9 workspaces (mirrors the landing page local data)
-- ---------------------------------------------------------------------------

insert into public.workspace_metadata
  (workspace, name, description, icon, route, enabled, sort_order)
values
  ('calculator',   'Calculator',   '2D & 3D graphing',                          'calculator', '/calculator',   true, 1),
  ('fractal_lab',  'Fractal Lab',  'GPU fractals and complex dynamics',         'fractal',    '/fractal-lab',  true, 2),
  ('bloch_sphere', 'Bloch Sphere', 'Single-qubit visualization',                'bloch',      '/bloch-sphere', true, 3),
  ('four_d',       '4D',           'Polytopes and higher-dimensional geometry', 'four-d',     '/4d',           true, 4),
  ('topology',     'Topology',     'Shapes, deformation and homeomorphisms',    'topology',   '/topology',     true, 5),
  ('dynamics',     'Dynamics',     'Dynamical systems and phase portraits',     'dynamics',   '/dynamics',     true, 6),
  ('inspector',    'Inspector',    'Mathematical structure analysis',           'inspector',  '/inspector',    true, 7),
  ('notebook',     'Notebook',     'Reproducible mathematical experiments',     'notebook',   '/notebook',     true, 8),
  ('docs',         'Docs',         'Mathematical reference and documentation',  'docs',       '/docs',         true, 9)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2) Curated examples (gallery content, no owner)
--    3 of the 6 are flagged featured = true for the gallery highlight.
-- ---------------------------------------------------------------------------

insert into public.examples
  (title, slug, description, workspace, configuration, featured)
values
  (
    'Damped harmonic oscillator',
    'damped-harmonic-oscillator',
    'Oscillator with nonlinear damping: RK4 integration of the flow at mu = 1.2, with the trajectory settling onto the attracting cycle.',
    'dynamics',
    '{"system":"van_der_pol","mu":1.2,"method":"rk4"}'::jsonb,
    false
  ),
  (
    'Mandelbrot deep zoom',
    'mandelbrot-deep-zoom',
    'Deep pass over the Mandelbrot boundary with 1024 iterations and the paper palette.',
    'fractal_lab',
    '{"fractal":"mandelbrot","iterations":1024,"palette":"paper"}'::jsonb,
    true
  ),
  (
    'Tesseract double rotation',
    'tesseract-double-rotation',
    'The 4-cube rotating simultaneously in the xy and zw planes, projected down to 3D.',
    'four_d',
    '{"polytope":"tesseract","rotation_planes":["xy","zw"]}'::jsonb,
    true
  ),
  (
    'Gaussian surface',
    'gaussian-surface',
    'The normal curve a*exp(-x^2/2) with adjustable amplitude a, plus its reflected surface in 3D.',
    'calculator',
    '{"expression":"a*exp(-x^2/2)","a":1.0}'::jsonb,
    false
  ),
  (
    'Critical points of a cubic',
    'critical-points-cubic',
    'Symbolic derivative of x^3-3x: local maximum at x = -1 and local minimum at x = 1, found without eval.',
    'inspector',
    '{"expression":"x^3-3x"}'::jsonb,
    false
  ),
  (
    'Van der Pol limit cycle',
    'van-der-pol-limit-cycle',
    'The classic relaxation-oscillation limit cycle of the van der Pol oscillator at mu = 1.5, drawn in phase space.',
    'dynamics',
    '{"system":"van_der_pol","mu":1.5}'::jsonb,
    true
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Tags (shared vocabulary; slug mirrors the name)
-- ---------------------------------------------------------------------------

insert into public.tags
  (name, slug)
values
  ('fractals',       'fractals'),
  ('dynamics',       'dynamics'),
  ('geometry',       'geometry'),
  ('calculus',       'calculus'),
  ('linear-algebra', 'linear-algebra'),
  ('visualization',  'visualization'),
  ('quantum',        'quantum'),
  ('topology',       'topology')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Deliberately NOT seeded (user data - no fake users):
--   profiles, projects, experiments, notebooks,
--   experiment_tags, project_tags, notebook_tags
-- ============================================================================
--  End of seed.sql
-- ============================================================================
