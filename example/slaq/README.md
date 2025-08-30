# slaq (Slack CLI example)

Hono + hono-cli-adapter で作る、**POST-only** の小さな Slack CLI。
パラメータは Zod で検証。Slack API 呼び出しは **form (x-www-form-urlencoded) 統一**。
Bun で単体バイナリ（1ファイル）にもできます。

> ⚠️ npm には `slaq` というパッケージが既に存在するため、この例では公開名を `slaq-cli` にしています。`npx slaq-cli` や `bunx slaq-cli` で実行できますが、CLI コマンド自体は `slaq` です。

## 要件
- Node 18+（グローバル fetch）
- （任意）Bun 1.1+（単体バイナリ化）

## インストール
```bash
npm i
```

## 使い方

### ルート一覧

```bash
node ./cli.mjs --list
# or
node ./cli.mjs --help
```

### 環境変数
- 必須: `SLACK_BOT_TOKEN`
- 任意: `SLACK_USER_TOKEN`（Private チャンネルの閲覧などで使用）

`hono-cli-adapter` 経由で `--env KEY=VALUE` を繰り返し指定すると、`c.env` にマージされます。
例: `node ./cli.mjs whoami --env SLACK_BOT_TOKEN=xoxb-***`

## 実行例

```bash
# whoami
SLACK_BOT_TOKEN=xoxb-*** node ./cli.mjs whoami

# 投稿
node ./cli.mjs post -- channel=C123456 text="やっほー" thread_ts=1724952000.000000

# スレッド取得
node ./cli.mjs thread.get -- channel=C123456 ts=1724952000.000000

# ファイル一覧
node ./cli.mjs files.list -- channel=C123456 count=50

# ダウンロード（ローカルFSへ保存）
node ./cli.mjs files.download -- file_id=F12345 out=/abs/path/file.bin

# アップロード
node ./cli.mjs upload -- channel=C123456 file=/abs/path/file.pdf title=資料 comment="投下します"
```

`--json` を付けると `{ status, data }` 形式で整形出力（adapter 機能）。

## Bun で単体バイナリ

```bash
npm run build:bin
./bin/slaq --list
./bin/slaq whoami --env SLACK_BOT_TOKEN=xoxb-***
```

## 設計ポイント
- POST-only（CLI からの呼び出しが安定）
- form 統一（blocks 等のオブジェクトは内部で JSON 文字列化）
- app.use に共通処理集約（POST強制、query+body マージ、トークン注入）
- Zod 検証（app.use('/path', useToken(), validateMerged(schema))）
- ハンドラは薄く c.json（Slack クライアントは “素のデータ” を返す）

雑味は upstream に置かず、CLI 側で味付けする方針です。
