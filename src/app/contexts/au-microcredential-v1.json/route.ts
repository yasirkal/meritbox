/** JSON-LD context for Australian extensions (National Microcredentials Framework fields). */
export function GET() {
  const ns = "https://meritbox.com.au/ns/au#";
  return Response.json(
    {
      "@context": {
        "@protected": true,
        microcredential: { "@id": `${ns}microcredential`, "@type": "@id" },
        AustralianMicrocredential: {
          "@id": `${ns}AustralianMicrocredential`,
          "@context": {
            "@protected": true,
            framework: `${ns}framework`,
            volumeOfLearningHours: { "@id": `${ns}volumeOfLearningHours`, "@type": "http://www.w3.org/2001/XMLSchema#integer" },
            aqfLevel: { "@id": `${ns}aqfLevel`, "@type": "http://www.w3.org/2001/XMLSchema#integer" },
            assessmentType: `${ns}assessmentType`,
            deliveryMode: `${ns}deliveryMode`,
            creditRecognition: `${ns}creditRecognition`,
            industryEndorsement: `${ns}industryEndorsement`,
          },
        },
      },
    },
    { headers: { "content-type": "application/ld+json", "cache-control": "public, max-age=86400" } },
  );
}
