import { Link } from "react-router"

/** Any address the rail does not know: say so in the product's voice, and offer the way back. */
export function NotFoundPage() {
  return (
    <div className="grid min-h-[60svh] place-items-center p-6">
      <div className="max-w-sm text-center">
        <p className="label">Fault · no such feeder</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Nothing is connected here.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This address is not on the network. The control room is one step back.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Back to the overview
        </Link>
      </div>
    </div>
  )
}
