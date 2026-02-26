const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guiltfree.vercel.app";
const pageUrl = `${appUrl}/profile`;
const imageUrl = `${appUrl}/profile/opengraph-image`;

export default function Head() {
  return (
    <>
      <title>Profile | GuiltFree</title>
      <meta name="description" content="Manage your profile, AI settings, and bring-your-own-key providers." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content="Profile | GuiltFree" />
      <meta property="og:description" content="Manage your profile, AI settings, and bring-your-own-key providers." />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Profile | GuiltFree" />
      <meta name="twitter:description" content="Manage your profile, AI settings, and bring-your-own-key providers." />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
