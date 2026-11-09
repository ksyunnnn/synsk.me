-- fetch_result に、取得元が前回返した ETag と Last-Modified の値を持つ列を足す。書き方の
-- 決まりは 0003 の冒頭にある。
--
-- 定期の取得で、取得元に条件付きの要求（If-None-Match・If-Modified-Since）を送り、
-- 変わっていない取得元の中身を取り直さないため（specs/004-external-activity/research.md の
-- R9）。どちらも、取得元が返さなければ NULL。値は応答のヘッダの文字列のまま持ち、
-- 次の要求に同じ文字列を送る。Last-Modified は HTTP の日付の形（例: Mon, 09 Nov 2026
-- 05:00:00 GMT）のまま持ち、日時の列（_at の列）の形に直さない。DB もアプリケーションも
-- この値を日時として読まず、取得元へ返すだけだから。列の名前はヘッダの名前に揃える
--
-- NULL を許し既定値を持たない列は ALTER TABLE ADD COLUMN で足せるため、表を作り直さない。
-- 既にある行は、両方の列が NULL になる
ALTER TABLE fetch_result ADD COLUMN etag TEXT;

ALTER TABLE fetch_result ADD COLUMN last_modified TEXT;
