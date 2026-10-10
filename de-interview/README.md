# Data Engineering Interview Bank

Static, single-page dashboard of scenario-based data engineering interview questions with worked answers, code, and interviewer follow-ups. Everything lives in one file (`index.html`): no build step, no dependencies, no backend.

Live site: https://de-interview-dashboard.vercel.app

## What is inside

Questions are grouped into categories, all using the same ecommerce orders dataset so patterns carry across topics.

- **Core topics:** Spark, Delta Lake, Delta Live Tables, Snowflake performance, SQL on the order table, AI engineering, architecture and incidents
- **Architecture tracks:** answer framework; Track A (batch + streaming: Lambda and Kappa); Track B (warehouse: Redshift and Postgres); Track C (Medallion on Databricks Delta); AWS track; incident scenarios; architecture comparison. Each track covers late-arriving data, data quality exceptions, and backfill / backtracking
- **Tools and skills:** AWS, Glue and Airflow; Databricks lakehouse (MERGE upserts, streaming tables, materialized views, medallion placement); Snowflake warehouse (stages, COPY INTO, Snowpipe, streams and tasks, dynamic tables); tool-by-problem cheat sheet
- **Practice:** mock interview prompt and answers worth memorising

Features: search across all questions, expand/collapse, per-question "Reviewed" checkboxes with a progress bar (saved in the browser's localStorage), copy buttons on code blocks, light and dark mode.

## Deploy on Vercel

1. Put these files in the **root** of the Git repo (`index.html`, `vercel.json`, `README.md`).
2. In Vercel, import the repo.
3. Framework Preset: **Other**. Build command: none. Output directory: the repo root (leave default).
4. Every push to `main` redeploys.

`vercel.json` enables clean URLs and adds two basic security headers. `index.html` at the root means the site is served at `/`.

## Edit the content

The questions are a JSON object named `DATA` inside the `<script>` block of `index.html`:

```
DATA = { intro: "<html>", cats: [ { id, name, items: [ { q: "question", a: "<html answer>" } ] } ] }
```

- Add a question: append `{ "q": "...", "a": "<p>...</p>" }` to a category's `items`.
- Add a category: add an object to `cats`, then add its `id` to the `COLORS` map and a matching `--c-<id>` colour variable in the `:root` CSS block.
- Answers are HTML. Code goes in `<pre><code class="language-sql">...</code></pre>`.

Product names and syntax in Databricks and Snowflake change between releases (for example Delta Live Tables is now called Lakeflow Spark Declarative Pipelines). Check against current docs before an interview.

## Local preview

Open `index.html` in a browser, or run `npx serve .` in this folder.
