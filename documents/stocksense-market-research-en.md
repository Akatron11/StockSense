# StockSense Project — Market Research on Existing Systems

> Source: `topic.pdf` — the "StockSense: Stock Control POS & Store Remodeling Recommender" project brief.
> This document lists systems that already exist in the areas this project touches (POS, inventory, sales analytics, store layout recommendation), for comparison and positioning.
>
> **Note:** The brief suggests a team of 3 students, but this project is being built **solo (one person)**. All scope, time, and method advice in this document is adjusted for that — the plan favors sequential, low-maintenance choices over parallel work.

---

## 1. POS + Inventory Management
Systems that directly match "checkout + reduce stock," the closest direct competitors.

| Name | Note |
|---|---|
| **Square POS** | Common in small retail, strong inventory module |
| **Shopify POS** | Combines online store with physical store |
| **Lightspeed Retail** (formerly Vend) | Built for retail, syncs many terminals |
| **Toast POS** | Mostly restaurant/retail mixed use |
| **Clover POS** | Sold as a hardware + software bundle |
| **Odoo POS** | Open source / self-hosted option |

## 2. Store Layout / Planogram Software
The category closest to the "store remodeling recommendation" part — the project's main point of difference.

| Name | Note |
|---|---|
| **Blue Yonder Space Planning** (formerly JDA Space Planning) | Enterprise-level shelf/layout optimization |
| **Nielsen Spaceman** | One of the best-known planogram tools in the industry |
| **Symphony RetailAI** | Data-driven shelf and category management |
| **Impact Analytics** | Space/assortment optimization |

## 3. Market Basket Analysis / Association Rule Mining Tools
General-purpose tools that match the project's technical core (co-occurrence, Apriori).

| Name | Note |
|---|---|
| **mlxtend** (Python) | The library the brief names directly, for Apriori/association rules |
| **Orange Data Mining** | Visual/no-code interface for association rule mining |
| **RapidMiner** | Enterprise data mining platform |
| **IBM SPSS Modeler** | Has an Association Rules module |

## 4. Computer-Vision-Based Store Analytics (Out-of-Scope Reference)
An approach the brief explicitly marks "Out of Scope"; added here only so it isn't confused with the project.

| Name | Note |
|---|---|
| **Trax Retail** | Shelf imaging + computer-vision stock detection |
| **Focal Systems** | Automated shelf/stock tracking, camera-based |

---

## Square POS vs Lightspeed Retail — Detailed Comparison

### What They Share
- Both are cloud-based, multi-terminal POS + inventory tools.
- Both charge similar card processing fees: ~2.6% + 10¢ per in-person transaction.
- Both offer a web + mobile companion app, sales reporting, stock tracking, and low-stock alerts.
- Both target small-to-medium retailers and promise fast setup.
- Both can be extended with third-party integrations (accounting, e-commerce).

### Where They Differ

| Criterion | Square POS | Lightspeed Retail |
|---|---|---|
| Pricing model | Free plan available, no monthly fee at the basic level | Has a monthly base fee (~$89/month), no free plan |
| Target audience | Small business, single location, simple catalog | Multi-location, growing retailers with complex product catalogs |
| Inventory depth | Basic; variant/purchase-order tracking needs the paid "Retail Plus" add-on | Strong built-in inventory: variant matrices, serial number tracking, purchase-order workflows |
| Multi-location management | Limited | Centralized stock sync, consolidated reporting |
| Reporting | Basic sales reports | Deeper, more detailed analytics |
| Setup speed / learning curve | Instant, minimal learning curve | Needs more configuration, steeper learning curve |
| Extra ecosystem | Payments, payroll, online ordering — one integrated vendor | Restaurant mode with table management, kitchen display, etc. |

---

## Blue Yonder Space Planning vs Nielsen Spaceman (NIQ) — Comparison

### What They Share
- Both are enterprise-grade planogram software — drag-and-drop product placement on a virtual shelf/fixture.
- Both optimize using sales/performance data (metrics like space-to-sales, profit per linear foot).
- Both offer store clustering and "what-if" scenario simulation.
- Both support real-time HQ-to-store sync and distribution.
- Both target large CPG/retail chains and are sold as a separate "space management" layer, not built into a POS.

### Where They Differ

| Criterion | Blue Yonder Space Planning | Nielsen Spaceman (NIQ) |
|---|---|---|
| Positioning | The "industry standard" for planogramming, large-scale enterprise | Space planning tied to Nielsen's own market data |
| Standout 2026 feature | AI agents that let planners edit planograms in natural language, in bulk | A "smart placement algorithm" for automatic, localized planogram generation |
| Data source | Its own sales/performance data | Analysis enriched with Nielsen's own market measurement data |
| Collaboration model | Web-based; supplier and store teams can co-edit "one shared version" | A synced digital environment for HQ-to-store communication |
| Claimed business impact | Up to 50% gain in operational efficiency | 10–20% revenue increase (from better space allocation) |

### Common Point — Both Are Outside StockSense's Scope
Both are large-scale, separately-sold enterprise products — not built into a POS. They are out of reach for a small store and offer big corporate "space-to-sales" optimization engines instead of a simple, visible association-rule/co-occurrence recommendation. This confirms the gap at rows 8–10 (a small-scale, POS-embedded, simple but demonstrable layout recommendation).

---

## Row 8 — Choosing a Method for the Layout Recommendation Engine

### Option 1: Simple Co-occurrence Counting
Counts how often product pairs appear together in receipts (e.g. "Chips–Cola: sold together 204 times, 68% co-purchase rate").

**Pros:** Fast to build (a few hours with pandas), easy and intuitive to explain, gives meaningful results even on a small seed dataset, no parameter-tuning headaches.
**Cons:** Naturally only catches pairs (not triples or larger groups), carries no statistical strength (can't tell a real relationship from coincidence), looks academically thinner next to Apriori.

### Option 2: Apriori / Association Rule Mining (mlxtend)
Works with three metrics: support, confidence, and **lift**. Lift > 1 means a real relationship; lift ≈ 1 means coincidence. It can also catch multi-item groups (A+B+C).

**Pros:** Filters out false positives, catches multi-item groups, carries more academic weight since the brief names this method directly, and is easy to extend later.
**Cons:** Sensitive to parameters (wrong min-support/confidence thresholds mean either no rules or too many meaningless ones), can be weak/noisy on a small seed dataset, harder to explain intuitively ("lift 2.3" is less obvious than a plain count), and takes longer to build.

### Option 3: Hybrid Approach
Layer 1 (MUST): Use simple co-occurrence counting to guarantee the base recommendation. Layer 2 (only if time allows): use mlxtend to compute the lift score for the strongest pairs, as a "statistical confirmation" layer (e.g. "sold together 204 times — lift score 2.3, so this isn't coincidence").

**Pros:** Low risk (co-occurrence always satisfies the MUST requirement), adds academic depth, still stays easy to explain, and development time is bounded (Layer 2 is optional).

**Cons:**
- **Maintenance load (heavier for solo work):** Two separate analysis engines mean two code paths, two test scenarios, more surface for bugs. This trade-off was first assessed assuming a 3-person team; since the project is **solo**, the downside grows — one person is the developer, tester, and time manager all at once, and has to maintain both engines alone, one after another rather than in parallel.
- **Conflicting results:** The pair co-occurrence calls "strongest" may not be the same pair Apriori's lift calls "strongest" — reconciling the two needs extra logic.
- **Justification risk:** The brief already says "co-occurrence OR association-rule mining, either is fine" — doing both can read as unnecessary complexity (over-engineering) rather than a sound architectural decision, and it invites the question "why did you build two?"
- **Time-budget risk (critical solo):** Even though Layer 2 is "optional," in practice the instinct to "finish what we started" can pull time away from actual MUST/SHOULD work (like row 9's floor-plan visualization). With a team, another member could offset this risk; solo, it depends entirely on self-discipline.
- **Doubtful payoff on small data:** If the seed dataset is limited, the second layer's lift calculation may add noise and confusion rather than confidence.

### Current Status
No decision has been made yet — all three options remain open. Because the time budget is much tighter for solo development, the hybrid approach's extra maintenance cost weighs more heavily; **Option 1 (simple co-occurrence)** currently looks like the safer default, but the final call hasn't been made.

### Solo Development Order for Rows 8 → 9 → 10
With no team, there's no way to split the work in parallel; the rows should be tackled in sequence:

1. **Finish row 8 first, completely** — moving to row 9 before the analysis engine's output format (which product, which zone, which score) is settled risks unnecessary rework.
2. **Then row 9** — once row 8's output format is fixed, the floor-plan visualization can be wired directly to real data, skipping a mock-data stage.
3. **Row 10 last, only if time allows** — it's already the lowest priority (COULD level) and builds on both rows 8 and 9, so it shouldn't start before those two are settled.

Row 9's visualization *can* technically be coded as a skeleton (drawing from static/sample data) before row 8 is done, but real integration depends on row 8's output format — so to reduce the cost of context-switching solo, it's better to **finish row 8, then move to row 9**.

---

## Gap-Fill Table — POS & Inventory Management

StockSense's target position on this axis: a middle ground that is **as easy to learn as Square, while approaching Lightspeed's inventory depth** only where the brief asks for it.

| Dimension | Square POS | **StockSense (Target)** | Lightspeed Retail |
|---|---|---|---|
| Learning curve | Very easy — instant use | **Easy** — a checkout flow as simple as Square's | Medium/hard — needs configuration |
| Basic checkout flow | Yes, simple | **Yes** — select item, set quantity, complete sale | Yes, may involve more steps/options |
| Stock decrement (concurrency) | Yes, but details aren't transparent | **Yes** — the real concurrency scenario the brief explicitly asks for (2 terminals, last unit) will be tested | Yes, tested at enterprise scale |
| Manual SKU/code entry | Yes | **Yes** (SHOULD) — fast checkout without barcode hardware | Yes |
| Low-stock alert | Yes (more flexible in Retail Plus) | **Yes** — configurable threshold (MUST) | Yes, with more advanced rules |
| Variant / serial-number tracking | In a paid add-on | No (out of scope, not requested by the brief) | Yes — a strong point |
| Purchase order (PO) workflow | In a paid add-on | No (out of scope) | Yes — a strong point |
| Multi-terminal sync | Yes, basic level | **Yes** (optional, via WebSockets) — matches the brief's "real-time sync" note | Yes, solid at enterprise level |
| Inventory depth (overall) | Basic | **Medium** — add/edit stock + view levels, no advanced variant management | Deep — complex catalogs, multiple locations |
| Pricing model position | Free/low cost | (Academic project — market pricing is out of scope) | Monthly base fee, more expensive |

### Takeaway
This table shows that on the POS/inventory axis, StockSense keeps **Square's simplicity** while only approaching **Lightspeed's depth to the extent the brief asks for** (configurable low-stock threshold, concurrency-safe decrement, basic reporting) — not matching it fully. Areas where Lightspeed is genuinely strong, like variant matrices and PO workflows, are deliberately left out of scope. This is consistent with the project's "don't try to do everything" strategy.

---

## Requirement-by-Requirement Gap-Fill Table (Based on the Brief)

For every requirement listed in the brief, whether Square POS and Lightspeed Retail already cover it is marked (✅ Yes / ❌ No / ⚠️ Partial). The **Gap (StockSense)** column is explained in detail below the table.

| # | Requirement (Brief) | Priority | Square POS | Lightspeed Retail | Gap (StockSense) |
|---|---|---|---|---|---|
| 1 | Working POS flow: select item, set quantity, complete sale, stock decrements | MUST | ✅ Yes | ✅ Yes | Parity |
| 2 | Concurrency safety for 2 terminals selling the last unit at the same time | MUST | ⚠️ Partial — real-time stock sync exists, but race-condition behavior isn't publicly documented | ⚠️ Partial — strong multi-location/terminal sync, but last-unit race behavior isn't documented | Explicitly proven concurrency safety (live demo) |
| 3 | Manager can add/edit stock and view current levels | MUST | ✅ Yes | ✅ Yes | Parity, extend later only if time allows |
| 4 | Configurable low-stock alert threshold | MUST | ✅ Yes (in Retail Plus) | ✅ Yes | Parity, add a dynamic threshold suggestion (COULD) only if time allows |
| 5 | Manual SKU/code entry (no barcode hardware needed) | SHOULD | ✅ Yes | ✅ Yes | Parity |
| 6 | Sales report by item/category, selectable date range | MUST | ✅ Yes (Item sales, Category sales — Dashboard) | ✅ Yes (40+ built-in reports) | Parity (basic reports), integrate with the layout recommendation only if time allows |
| 7 | Best-seller/slow-mover detection from real sales data | MUST | ✅ Yes (Sell-through report) | ✅ Yes (Lightspeed Insights) | Parity (basic reports), integrate with the layout recommendation only if time allows |
| 8 | Co-occurrence / association-rule (Apriori) based store layout recommendation | MUST | ❌ No | ❌ No | **Still being researched** — the main point of difference; method (co-occurrence vs. Apriori) still to be decided |
| 9 | Visualize the recommendation as a simple layout/floor-plan diagram | SHOULD | ❌ No | ❌ No | **Still being researched** |
| 10 | Layout-change simulation + estimated improvement metric | COULD | ❌ No | ❌ No | **Still being researched** |
| 11 | Read-focused mobile companion app for the manager (stock, alerts, reports) | MUST | ✅ Yes (Square mobile app/Dashboard app) | ✅ Yes (Lightspeed mobile app) | Parity |

### Gap (StockSense) — Reasoned Explanations

**Row 1 — POS flow (select item, set quantity, complete sale, stock decrements):**
Parity. Square and Lightspeed already handle this basic flow without issue; looking for innovation here doesn't make sense, since this is a solved problem in the market. StockSense aims to match competitors here on correctness and reliability, and puts its development effort instead into the real point of difference in rows 8–10 (the layout recommendation).

**Row 2 — Concurrency safety for 2 terminals selling the last unit:**
Explicitly proven concurrency safety. Neither Square's nor Lightspeed's public documentation clearly explains how this scenario (two terminals "racing" for the last unit at the same time) behaves — meaning competitors don't make this a visible trust/marketing point. StockSense deliberately solves it with an atomic database update / row-level lock (e.g. PostgreSQL's `SELECT...FOR UPDATE` or an `UPDATE...WHERE stock > 0` pattern), and proves it with a live demo as the brief's "Definition of Done" asks (two terminals, last unit, one sale accepted and one rejected). This is a concrete trust point that sets the project apart, both on technical correctness and on "we visibly tested this."

**Rows 3–4 — Manager stock add/edit + configurable low-stock alert threshold:**
Parity first, extend only if there's an opportunity. Standard stock editing and a fixed/configurable threshold exist in both competitors; getting this right at the MUST level comes first. If time and capacity remain, a dynamic/suggested threshold based on sales velocity (e.g. "this item sells about 12/week, we suggest a threshold of 15 instead of 5") could be added at the COULD level — but since the brief doesn't ask for this, no resources go toward it until the MUSTs are secured. The goal: deliver safely first, then improve opportunistically.

**Row 5 — Manual SKU/code entry (no barcode hardware needed):**
Parity. Both systems offer this as standard; fast checkout without barcode hardware is a minor UX detail with no real potential for differentiation. Working correctly and quickly is enough.

**Rows 6–7 — Sales report by item/category + best-seller/slow-mover detection:**
Parity first (basic reports), then integration with the layout recommendation. Building a reporting layer as deep as Lightspeed's 40+ built-in reports or Square's Item/Category sales dashboard carries unnecessary risk given this project's scope and timeline — the brief only asks for "a date-range-selectable item/category report" and "best-seller/slow-mover detection from real data" (at the MUST level, not complex). Once those are delivered, if time remains, a one-click "see the layout recommendation based on this data" flow from the reporting screen can turn reporting and store-remodeling into one integrated story rather than two separate modules.

**Rows 8, 9, 10 — Co-occurrence/association-rule based layout recommendation, floor-plan visualization, simulation:**
Still being researched. These three rows are the direct answer to the brief's core value proposition ("small retail stores... have no data-driven sense of store layout") and the most critical part of the gap table — neither Square/Lightspeed (POS side) nor Blue Yonder Space Planning/Nielsen Spaceman (enterprise planogram side) offer this, or they offer it only as a large-scale, inaccessible enterprise product separate from any POS. StockSense's position: a layout recommendation that is small-scale, embedded in a POS, and simple but demonstrable (based on co-occurrence/Apriori and real sales data) — that gap is confirmed, but the method choice (simple co-occurrence counting vs. starting with Apriori/mlxtend) and any further lessons from Blue Yonder/Nielsen Spaceman haven't been finalized yet, so a decision is still pending.

**Row 11 — Read-focused mobile companion app for the manager:**
Parity. Both systems offer a mobile app for viewing stock, alerts, and reports. StockSense matches this with the same basic function via React Native/Flutter (read-only, not a full POS) — no differentiation is targeted here either.

---

### Observation (Overall Assessment of the Gap Table)
- Rows 1, 3–7, 11: Both systems already cover these basic POS/reporting requirements — there's no room for StockSense to differentiate here, just to "do it right."
- Row 2: Neither system's public documentation fully clarifies the exact scenario the brief describes (two terminals racing for the last unit) — testing and showing this explicitly in StockSense (which the brief's "Definition of Done" also asks for) could be a clear, demonstrable advantage.
- Rows 8–10: **This is where the real gap is.** Neither established system offers an association-rule/co-occurrence-based layout recommendation and its visualization. StockSense's core value proposition is concentrated in these three rows.
