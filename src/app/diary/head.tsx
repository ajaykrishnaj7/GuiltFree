const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";
const pageUrl = `${appUrl}/diary`;
const imageUrl = `${appUrl}/diary/opengraph-image`;

export default function Head() {
  return (
    <>
      <title>Diary | GuiltFree</title>
      <meta name="description" content="View your nutrition diary and logged meals in one timeline." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content="Diary | GuiltFree" />
      <meta property="og:description" content="View your nutrition diary and logged meals in one timeline." />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Diary | GuiltFree" />
      <meta name="twitter:description" content="View your nutrition diary and logged meals in one timeline." />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
