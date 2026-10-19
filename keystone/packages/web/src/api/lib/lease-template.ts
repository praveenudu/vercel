export function defaultClauses(opts: { landlord: string; tenant: string; address: string; lateFee: string; graceDays: number; deposit: string }) {
  return `1. PARTIES. This Residential Lease Agreement is entered into between ${opts.landlord} ("Landlord") and ${opts.tenant} ("Tenant") for the premises at ${opts.address} ("Premises").

2. TERM & RENT. Tenant agrees to pay monthly rent as stated in the lease summary, due on the due day of each month. Rent may be paid by Zelle, check, cash or ACH as directed by Landlord.

3. LATE FEES. Rent not received within ${opts.graceDays} days after the due date incurs a late fee of ${opts.lateFee}.

4. SECURITY DEPOSIT. Tenant shall deposit ${opts.deposit} as security, refundable per state law within the statutory period after move-out, less lawful deductions.

5. USE & OCCUPANCY. The Premises shall be used solely as a private residence for the occupants listed on the application.

6. MAINTENANCE & REPAIRS. Tenant shall keep the Premises clean and promptly report needed repairs through the Keystone tenant portal. Landlord shall make repairs required for habitability within a reasonable time.

7. ENTRY. Landlord may enter with at least 24 hours' notice for inspections, repairs or showings, or immediately in an emergency.

8. UTILITIES. Tenant is responsible for all utilities unless otherwise agreed in writing.

9. PETS. No pets without prior written consent of Landlord.

10. ALTERATIONS. Tenant shall make no alterations without Landlord's written consent.

11. INSURANCE. Tenant is encouraged to maintain renter's insurance.

12. DEFAULT. If Tenant fails to pay rent or breaches this Lease, Landlord may pursue remedies permitted by law.

13. ELECTRONIC SIGNATURES. The parties agree that electronic signatures on this Lease are legally binding under the E-SIGN Act and UETA.

14. ENTIRE AGREEMENT. This Lease constitutes the entire agreement between the parties.`;
}
