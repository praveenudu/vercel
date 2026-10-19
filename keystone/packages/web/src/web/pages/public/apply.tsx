import { useState } from "react";
import { Link, useParams } from "wouter";
import { BedDouble, Bath, Ruler, Check, CalendarDays, ShieldCheck, ChevronLeft } from "lucide-react";
import { Logo } from "../../components/logo";
import { Button, Field, Input, Select, Loading, ErrorNote } from "../../components/ui/kit";
import { usePublicListing } from "../../queries/listings";
import { useSubmitApplication } from "../../queries/applications";
import { money, fmtDate, toCents, errMsg } from "../../lib/format";
import { cn } from "../../lib/utils";

const STEPS = ["About you", "Residence", "Income", "Household", "Consent"];

type Ref = { name: string; phone: string; relation: string };

export default function Apply() {
  const { unitId } = useParams<{ unitId: string }>();
  const listing = usePublicListing(Number(unitId));
  const submit = useSubmitApplication();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", phone: "", dob: "",
    currentAddress: "", monthsAtAddress: "", prevLandlord: "", prevLandlordPhone: "", priorEviction: "no",
    employer: "", jobTitle: "", monthlyIncome: "", employmentMonths: "",
    occupants: "1", pets: "", moveInDate: "", consentSignature: "", consent: false,
  });
  const [refs, setRefs] = useState<Ref[]>([{ name: "", phone: "", relation: "" }]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (listing.isLoading) return <Loading />;
  if (listing.error || !listing.data)
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <Logo />
          <p className="mt-6 text-body">This listing is no longer accepting applications.</p>
          <Link href="/" className="mt-3 inline-block text-brand font-semibold">Back to Keystone</Link>
        </div>
      </div>
    );
  const { unit, property, landlordName } = listing.data;
  const rent = unit.rent;
  const ratio = rent ? toCents(f.monthlyIncome) / rent : 0;

  const valid = [
    f.firstName && f.lastName && /\S+@\S+\.\S+/.test(f.email) && f.phone,
    f.currentAddress && f.monthsAtAddress !== "",
    f.employer && f.monthlyIncome,
    Number(f.occupants) >= 1,
    f.consent && f.consentSignature.trim().length >= 2,
  ][step];

  const send = async () => {
    setErr(null);
    try {
      await submit.mutateAsync({
        unitId: unit.id,
        firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone, dob: f.dob,
        currentAddress: f.currentAddress, monthsAtAddress: Number(f.monthsAtAddress || 0),
        employer: f.employer, jobTitle: f.jobTitle, monthlyIncome: toCents(f.monthlyIncome), employmentMonths: Number(f.employmentMonths || 0),
        prevLandlord: f.prevLandlord, prevLandlordPhone: f.prevLandlordPhone, priorEviction: f.priorEviction === "yes",
        occupants: Number(f.occupants || 1), pets: f.pets, references: refs.filter((r) => r.name.trim()), moveInDate: f.moveInDate,
        consent: true, consentSignature: f.consentSignature.trim(),
      });
      setDone(true);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="min-h-screen bg-app">
      <header className="h-16 bg-white border-b border-line flex items-center px-5">
        <Logo />
        <span className="ml-4 pl-4 border-l border-line text-sm text-muted hidden sm:block">Rental application · {landlordName}</span>
      </header>
      <div className="max-w-[1100px] mx-auto px-5 py-8 grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <aside className="rounded-xl bg-white border border-line overflow-hidden lg:sticky lg:top-6">
          <img src="/images/listing.jpg" alt="" className="h-44 w-full object-cover" />
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">For rent</p>
            <h1 className="mt-1 text-xl font-extrabold text-navy leading-snug">{unit.listingTitle || `${property.name} · ${unit.name}`}</h1>
            <p className="text-sm text-muted mt-1">{property.address}, {unit.name} · {property.city}, {property.state} {property.zip}</p>
            <p className="mt-4 text-[28px] font-extrabold text-ink">{money(rent, { cents: false })}<span className="text-sm font-medium text-muted">/mo</span></p>
            <div className="mt-3 flex gap-4 text-sm text-body">
              <span className="flex items-center gap-1.5"><BedDouble className="size-4 text-brand" />{unit.beds} bd</span>
              <span className="flex items-center gap-1.5"><Bath className="size-4 text-brand" />{unit.baths} ba</span>
              {unit.sqft > 0 && <span className="flex items-center gap-1.5"><Ruler className="size-4 text-brand" />{unit.sqft} sqft</span>}
            </div>
            <div className="mt-3 text-sm text-body space-y-1">
              <p className="flex items-center gap-1.5"><CalendarDays className="size-4 text-brand" />Available {unit.availableDate ? fmtDate(unit.availableDate) : "now"}</p>
              <p>Deposit {money(unit.deposit, { cents: false })}</p>
            </div>
            {unit.listingDescription && <p className="mt-4 text-sm text-body leading-relaxed whitespace-pre-line">{unit.listingDescription}</p>}
          </div>
        </aside>

        <section className="rounded-xl bg-white border border-line">
          {done ? (
            <div className="p-10 text-center page-enter">
              <span className="mx-auto size-14 rounded-full bg-ok-tint text-ok grid place-items-center"><Check className="size-7" strokeWidth={3} /></span>
              <h2 className="mt-4 text-2xl font-extrabold text-navy">Application submitted</h2>
              <p className="mt-2 text-body max-w-md mx-auto">{landlordName || "The landlord"} will review your application and run screening. If approved, you'll receive a lease to e-sign by email at <b>{f.email}</b>.</p>
            </div>
          ) : (
            <>
              <div className="px-6 pt-6">
                <div className="flex gap-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex-1">
                      <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
                      <p className={cn("mt-2 text-[11px] font-semibold uppercase tracking-wider hidden sm:block", i === step ? "text-brand" : "text-muted")}>{s}</p>
                    </div>
                  ))}
                </div>
                <h2 className="mt-6 text-xl font-extrabold text-navy">{STEPS[step]}</h2>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-4 page-enter" key={step}>
                {step === 0 && (
                  <>
                    <Field label="First name"><Input value={f.firstName} onChange={set("firstName")} /></Field>
                    <Field label="Last name"><Input value={f.lastName} onChange={set("lastName")} /></Field>
                    <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
                    <Field label="Phone"><Input value={f.phone} onChange={set("phone")} placeholder="(555) 555-0100" /></Field>
                    <Field label="Date of birth"><Input type="date" value={f.dob} onChange={set("dob")} /></Field>
                    <Field label="Desired move-in"><Input type="date" value={f.moveInDate} onChange={set("moveInDate")} /></Field>
                  </>
                )}
                {step === 1 && (
                  <>
                    <Field label="Current address" className="sm:col-span-2"><Input value={f.currentAddress} onChange={set("currentAddress")} /></Field>
                    <Field label="Months at this address"><Input type="number" min={0} value={f.monthsAtAddress} onChange={set("monthsAtAddress")} /></Field>
                    <Field label="Ever been evicted?">
                      <Select value={f.priorEviction} onChange={set("priorEviction")}><option value="no">No</option><option value="yes">Yes</option></Select>
                    </Field>
                    <Field label="Current / previous landlord"><Input value={f.prevLandlord} onChange={set("prevLandlord")} /></Field>
                    <Field label="Landlord phone"><Input value={f.prevLandlordPhone} onChange={set("prevLandlordPhone")} /></Field>
                  </>
                )}
                {step === 2 && (
                  <>
                    <Field label="Employer"><Input value={f.employer} onChange={set("employer")} /></Field>
                    <Field label="Job title"><Input value={f.jobTitle} onChange={set("jobTitle")} /></Field>
                    <Field label="Gross monthly income ($)"><Input type="number" min={0} value={f.monthlyIncome} onChange={set("monthlyIncome")} /></Field>
                    <Field label="Months with employer"><Input type="number" min={0} value={f.employmentMonths} onChange={set("employmentMonths")} /></Field>
                    {f.monthlyIncome && rent > 0 && (
                      <p className={cn("sm:col-span-2 text-sm rounded-md px-3 py-2", ratio >= 3 ? "bg-ok-tint text-ok" : "bg-warn-tint text-warn")}>
                        Income is {ratio.toFixed(1)}× the monthly rent{ratio >= 3 ? " — meets the typical 3× guideline." : ". Most landlords look for 3×."}
                      </p>
                    )}
                  </>
                )}
                {step === 3 && (
                  <>
                    <Field label="Total occupants"><Input type="number" min={1} value={f.occupants} onChange={set("occupants")} /></Field>
                    <Field label="Pets"><Input value={f.pets} onChange={set("pets")} placeholder="e.g. 1 cat" /></Field>
                    <div className="sm:col-span-2">
                      <p className="text-[13px] font-semibold text-ink mb-2">References</p>
                      <div className="space-y-2">
                        {refs.map((r, i) => (
                          <div key={i} className="grid grid-cols-3 gap-2">
                            <Input placeholder="Name" value={r.name} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                            <Input placeholder="Phone" value={r.phone} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                            <Input placeholder="Relation" value={r.relation} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} />
                          </div>
                        ))}
                      </div>
                      {refs.length < 3 && (
                        <button onClick={() => setRefs([...refs, { name: "", phone: "", relation: "" }])} className="mt-2 text-sm font-semibold text-brand cursor-pointer">+ Add reference</button>
                      )}
                    </div>
                  </>
                )}
                {step === 4 && (
                  <div className="sm:col-span-2 space-y-4">
                    <div className="rounded-lg border border-line bg-app/60 p-4 text-sm text-body leading-relaxed">
                      <p className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="size-4 text-brand" /> Screening authorization</p>
                      <p className="mt-2">I authorize {landlordName || "the landlord"} and its screening provider (TransUnion SmartMove) to obtain my credit report, criminal background and eviction history for the purpose of evaluating this rental application. I certify the information provided is true and complete.</p>
                    </div>
                    <label className="flex items-start gap-2.5 text-sm text-ink cursor-pointer">
                      <input type="checkbox" aria-label="Consent to screening" className="mt-0.5 size-4 accent-[#2f6eb5]" checked={f.consent} onChange={(e) => setF((x) => ({ ...x, consent: e.target.checked }))} />
                      I agree to the screening authorization above.
                    </label>
                    <Field label="Type your full legal name to sign">
                      <Input value={f.consentSignature} onChange={set("consentSignature")} placeholder={`${f.firstName} ${f.lastName}`.trim() || "Full name"} />
                    </Field>
                    {f.consentSignature && <p className="font-sig text-4xl text-navy border-b border-ink/30 pb-1">{f.consentSignature}</p>}
                  </div>
                )}
              </div>
              <div className="px-6 pb-6 flex items-center gap-3">
                {step > 0 && (
                  <Button variant="ghost" onClick={() => setStep(step - 1)} icon={<ChevronLeft className="size-4" />}>Back</Button>
                )}
                <div className="ml-auto flex items-center gap-3">
                  {err && <ErrorNote error={err} />}
                  {step < STEPS.length - 1 ? (
                    <Button onClick={() => setStep(step + 1)} disabled={!valid}>Continue</Button>
                  ) : (
                    <Button onClick={send} disabled={!valid} loading={submit.isPending}>Submit application</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
