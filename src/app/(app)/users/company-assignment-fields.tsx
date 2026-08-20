export type AssignableCompanyOption = {
  id: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE";
};

export function CompanyAssignmentFields({
  companies,
  register,
}: {
  companies: readonly AssignableCompanyOption[];
  register: (name: "companyIds") => Record<string, unknown>;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Assigned companies</legend>
      <p className="text-muted-foreground text-xs">
        Admin may access all companies. Compliance and Staff can access only assigned companies.
        Reporting groups are not authorization.
      </p>
      {companies.length === 0 ? (
        <p className="text-muted-foreground text-sm">No companies exist yet.</p>
      ) : (
        <div className="grid gap-2">
          {companies.map((company) => (
            <label key={company.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={company.id} {...register("companyIds")} />
              <span>
                {company.displayName}
                {company.status === "INACTIVE" ? " (inactive)" : ""}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
