-- skill に、親のスキルを指す parent_id を足す。書き方の決まりは 0003 の冒頭にある。
--
-- スキルを、製品（D1・Lambda など）とそれを提供する基盤（Cloudflare・AWS など）の 1 段の親子で
-- 分ける（specs/001-career-and-project/spec.md の FR-031。issue #399）。親も 1 つのスキルの行で、
-- 親の経験年数は、親か子のどれかをつないだ実績の期間から求める（FR-033）。求めた値は保存しない。
-- NULL は親を持たないこと。この列を足す前の行は NULL になる
--
-- 自分自身を指さないことは列の CHECK が、親が親を持たないことはトリガが拒む。アプリケーションの
-- 入力の検査を通らない書き込みも拒む（docs/SOFTWARE_DESIGN.md の原則 2）
--
-- 既定値が NULL で、外部キーと CHECK を持つ列は ALTER TABLE ADD COLUMN で足せるため、表を作り
-- 直さない（https://www.sqlite.org/lang_altertable.html#altertabaddcol）。外部キーは 0003 の
-- 決まりのとおり NO ACTION で、子を持つ親の行を消すと削除はエラーで止まる
ALTER TABLE skill ADD COLUMN parent_id INTEGER REFERENCES skill (id) CHECK (
  parent_id IS NULL OR parent_id <> id
);

CREATE INDEX skill_parent_id ON skill (parent_id);

-- 親にするスキルが親を持っていれば拒む。登録する行はまだ子を持たない（外部キーが、無い id を
-- 指す行を拒むため）
CREATE TRIGGER skill_parent_depth_insert
BEFORE INSERT ON skill
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM skill WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'skill_parent_depth');
END;

-- 親にするスキルが親を持つか、親を付ける行が子を持っていれば拒む
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
