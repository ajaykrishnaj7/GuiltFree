const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";
const pageUrl = `${appUrl}/history`;
const imageUrl = `${appUrl}/history/opengraph-image`;

export default function Head() {
  return (
    <>
      <title>History | GuiltFree</title>
      <meta name="description" content="Browse your meal history with detailed dish and macro breakdowns." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content="History | GuiltFree" />
      <meta property="og:description" content="Browse your meal history with detailed dish and macro breakdowns." />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="History | GuiltFree" />
      <meta name="twitter:description" content="Browse your meal history with detailed dish and macro breakdowns." />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
