-- skill に、親のスキルを指す parent_id と、役割 role を足す。書き方の決まりは 0003 の冒頭にある。
--
-- スキルを、提供元と役割の 2 つの軸で分ける（specs/001-career-and-project/spec.md の FR-031。
-- issue #399）。1 本の親子の木に役割と提供元を両方入れると、1 つのスキルが 2 つの親を持つため
-- （GitHub Actions は GitHub の製品で、役割は CI）。
--
-- アプリケーションの入力の検査を通らない書き込みも拒む（docs/SOFTWARE_DESIGN.md の原則 2）。
-- 既定値が NULL で、外部キーと CHECK を持つ列は ALTER TABLE ADD COLUMN で足せるため、表を作り
-- 直さない（https://www.sqlite.org/lang_altertable.html#altertabaddcol）。この 2 列を足す前の行は
-- どちらも NULL になる

-- 提供元。製品（D1・Lambda など）とそれを提供する基盤（Cloudflare・AWS など）の 1 段の親子。
-- 親も 1 つのスキルの行で、親の経験年数は、親か子のどれかをつないだ実績の期間から求める
-- （FR-033）。求めた値は保存しない。NULL は親を持たないこと。
-- 自分自身を指さないことは列の CHECK が、親が親を持たないことはトリガが拒む。外部キーは 0003 の
-- 決まりのとおり NO ACTION で、子を持つ親の行を消すと削除はエラーで止まる
ALTER TABLE skill ADD COLUMN parent_id INTEGER REFERENCES skill (id) CHECK (
  parent_id IS NULL OR parent_id <> id
);

CREATE INDEX skill_parent_id ON skill (parent_id);

-- 役割。1 つのスキルに 1 つ。値と表示名の対応は src/features/skill/domain/skill.ts の
-- SKILL_ROLE_LABELS が持つ。値を英字の識別子で持つのは project.kind と同じ（ADR-0055）。
-- language は言語、framework はフレームワーク、ui は UI、state_management は状態管理、data は
-- データ、auth は認証、hosting はホスティング、testing はテスト、ci_quality は CI・品質、design は
-- デザイン、dev_tool は開発の道具、domain_specific は領域特化（特定の領域の依頼で効くもの）、
-- other はその他（どこにも入らないもの）。
-- NULL は役割を付けていないこと。親の行は役割を持たない。子を持つ行が役割を持たないことは
-- トリガが拒む。子をまだ持たない親の行は、親を持たないほかのスキルと表の上で見分けられないため、
-- 役割を空にするのは登録する側が守る
ALTER TABLE skill ADD COLUMN role TEXT CHECK (
  role IS NULL OR role IN (
    'language', 'framework', 'ui', 'state_management', 'data', 'auth', 'hosting', 'testing',
    'ci_quality', 'design', 'dev_tool', 'domain_specific', 'other'
  )
);

-- 親にするスキルが、親か役割を持っていれば拒む。登録する行はまだ子を持たない（外部キーが、無い
-- id を指す行を拒むため）
CREATE TRIGGER skill_parent_insert
BEFORE INSERT ON skill
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'skill_parent_depth')
  WHERE EXISTS (SELECT 1 FROM skill WHERE id = NEW.parent_id AND parent_id IS NOT NULL);
  SELECT RAISE(ABORT, 'skill_parent_role')
  WHERE EXISTS (SELECT 1 FROM skill WHERE id = NEW.parent_id AND role IS NOT NULL);
END;

-- 親にするスキルが親を持つか、親を付ける行が子を持っていれば、段が 2 つになるので拒む
CREATE TRIGGER skill_parent_depth_update
BEFORE UPDATE OF parent_id ON skill
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM skill WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM skill WHERE parent_id = NEW.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'skill_parent_depth');
END;

-- 役割を持つスキルを親にするか、子を持つ行に役割を付けるなら拒む
CREATE TRIGGER skill_parent_role_update
BEFORE UPDATE OF parent_id, role ON skill
FOR EACH ROW
WHEN (
    NEW.parent_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM skill WHERE id = NEW.parent_id AND role IS NOT NULL)
  )
  OR (NEW.role IS NOT NULL AND EXISTS (SELECT 1 FROM skill WHERE parent_id = NEW.id))
BEGIN
  SELECT RAISE(ABORT, 'skill_parent_role');
END;
