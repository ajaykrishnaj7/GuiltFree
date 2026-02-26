const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";
const pageUrl = `${appUrl}/trends`;
const imageUrl = `${appUrl}/trends/opengraph-image`;

export default function Head() {
  return (
    <>
      <title>Trends | GuiltFree</title>
      <meta name="description" content="See your daily, weekly, and monthly nutrition trends with goal reach insights." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content="Trends | GuiltFree" />
      <meta property="og:description" content="See your daily, weekly, and monthly nutrition trends with goal reach insights." />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Trends | GuiltFree" />
      <meta name="twitter:description" content="See your daily, weekly, and monthly nutrition trends with goal reach insights." />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
