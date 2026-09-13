# InBody on Daybreak — what to track, and why

Research behind the InBody feature. Sources at the bottom.

---

## The one idea that makes the sheet readable

**Percent body fat is a ratio, and both halves move.**

Gain three pounds of muscle and lose three pounds of fat: your weight is identical, your
percentage barely twitches, and you have just had the best month of your training life.

That is also exactly the month people quit — because the scale said nothing happened and
the percentage agreed with it.

So Daybreak leads with the two **absolute** numbers — pounds of muscle, pounds of fat —
and treats the percentage as commentary.

---

## The four worth crossing the room for

### 1. Skeletal Muscle Mass (lb)
The thing perimenopause takes and lifting defends. Muscle mass follows a **decreasing
trajectory through the perimenopausal transition**, and it is the single metric that says
whether the training and the protein are doing their job. Everything else on the sheet is
downstream of this one.

### 2. Body Fat Mass (lb) — not the percentage
The other half of the recomposition story. In pounds it cannot lie to you the way a ratio
can.

### 3. Visceral Fat (level, or area in cm²)
The fat packed around the organs, as opposed to under the skin. It matters here for three
separate reasons:

- **It rises through the menopausal transition independently of weight.** Total and
  visceral fat area increase significantly during the transition, and the shift is *most
  pronounced in normal-weight women* — so the scale can be flat while this climbs.
- **It predicts cardiometabolic risk**, and the visceral-fat-to-muscle ratio is associated
  with cardiometabolic disease *more strongly in women than in men*.
- **It is inversely associated with bone density** in perimenopausal women — fat
  *distribution*, rather than total fat, appears to be what matters for osteoporosis risk.

This is the number the cardio pillar is actually for. InBody's line is **level 10**, which
equates to roughly **100 cm²**. Daybreak accepts whichever format the sheet prints.

### 4. ECW/TBW — the honesty check
The share of body water sitting *outside* the cells. **Normal is below 0.390.** It climbs
with inflammation, swelling, a hard session two days ago, a salty dinner, or the week
before a period.

This one is not a goal, it is a **data-quality flag**. Impedance is a water measurement
underneath, so when ECW/TBW is high the muscle/fat split is being computed from distorted
water — and a scan claiming "you lost two pounds of muscle" is far more likely to be fluid
than muscle. Daybreak says so on the card rather than letting a bad scan ruin her week.

---

## Also captured, folded away

Percent body fat (healthy range for women is quoted as 18–28%), BMR, and segmental lean
mass for the legs — which is where glute and leg work shows up before it shows up
anywhere else.

## Derived

**Muscle-to-fat ratio.** One number that climbs whenever she is trading the right way,
whichever direction the scale goes. This is the chart on the card.

---

## How to take it so two scans can be compared

Every one of these is a real source of drift, not fussiness:

- **Same time of day, every time.** Morning is best, before eating or training.
- **Bathroom first.** A full bladder is weight the machine reads as you.
- **No coffee that morning**, and nothing to drink in the 45 minutes before.
- **Not within 6–12 hours of training.** Exercise shifts water around.
- **Bare feet, same clothing weight, no jewellery.**

**On the cycle:** water retention around a period moves the numbers by a pound or two in
either direction. The guidance splits — some sources say a scan taken mid-cycle may be
unreliable, others say never skip one. Daybreak takes the second position and adds the
reason: **note it, do not skip it, and read the trend across months rather than the jump
between two scans.**

---

## Why it is typed in rather than synced

LookinBody Web — the system behind the club's unit — is a **facility back-end**. Its login
offers "Administrator" and "Staff" roles; there is no consumer app, no published public
API, and no documented member-level export. Daybreak has no server and no account to
authenticate with even if there were one.

So: four boxes off the printed sheet, under a minute, and every byte stays on the phone
like the rest of the app. That is the honest answer, and it is written into the empty
state so she is not left wondering whether sync is broken.

---

## Sources

- [The Impact of the Menopausal Transition on Body Composition and Abdominal Fat Redistribution](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12842199/)
- [Association between visceral fat and bone mineral density in perimenopausal women](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11830370/)
- [Increased visceral fat area to skeletal muscle mass ratio and cardiometabolic disease risk](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10078378/)
- [Skeletal Muscle Mass-to-Visceral Fat Ratio and cardiometabolic risk in women](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10097179/)
- [One-year trajectories of nutritional status in perimenopausal women](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10976711/)
- [Menopause symptoms and muscle mass index in perimenopausal and postmenopausal women](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12325020/)
- [InBody 380 Result Sheet Interpretation](https://inbodycanada.ca/inbody-380-result-sheet-interpretation/)
- [The InBody Test — InBody USA](https://inbodyusa.com/general/inbody-test/)
- [How to Take Your InBody Test Accurately — InBody Asia](https://inbodyasia.com/blog/how-to-take-your-inbody-test-accurately/)
- [How to Prepare for Your InBody Test — Providence](https://www.providence.org/-/media/project/psjh/providence/wa/files/eastern-wa-clinics/prepareforyourinbodytest.pdf)
- [LookinBody Web](https://usa.lookinbody.com)
