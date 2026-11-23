import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Not found</h1>
      <p className="muted mt-2">This page doesn&apos;t exist, or the credential is private.</p>
      <Link href="/" className="btn btn-primary mt-6">Home</Link>
    </main>
  );
}
