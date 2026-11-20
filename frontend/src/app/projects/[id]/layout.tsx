import type { Metadata, ResolvingMetadata } from 'next';
import React from 'react';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }> | { id: string };
};

export async function fetchProjectMetadata(id: string) {
  if (!id || id === 'undefined' || id === 'null') {
    return null;
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/projects/${id}`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.project || null;
  } catch (err) {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> | { id: string } },
  parent?: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  const project = id ? await fetchProjectMetadata(id) : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trustpay-escrow.vercel.app';
  const cleanAppUrl = appUrl.replace(/\/$/, '');

  if (!project) {
    const fallbackTitle = 'Project Not Found | TrustPay Escrow';
    const fallbackDescription =
      'The requested escrow project could not be found or may have been completed or removed on TrustPay Escrow.';
    const fallbackImage = `${cleanAppUrl}/og-image.png`;

    return {
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        url: `${cleanAppUrl}/projects/${id || 'unknown'}`,
        siteName: 'TrustPay Escrow',
        type: 'website',
        images: [
          {
            url: fallbackImage,
            width: 1200,
            height: 630,
            alt: 'TrustPay Escrow - Secure Stellar Escrow',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDescription,
        images: [fallbackImage],
      },
    };
  }

  // Acceptance Criteria: Generates dynamic page title: '[Budget] Project Title | TrustPay Escrow'
  const budgetAmount = project.budget ?? 0;
  const token = project.token || 'USDC';
  const budgetFormatted = `${budgetAmount} ${token}`;
  const title = `[${budgetFormatted}] ${project.title} | TrustPay Escrow`;

  const rawDesc =
    project.description ||
    `Escrow project ${project.title} with total budget of ${budgetFormatted} secured by Soroban smart contract on Stellar.`;
  const description =
    rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;

  const projectUrl = `${cleanAppUrl}/projects/${id}`;
  const ogImageUrl = `${cleanAppUrl}/api/og?title=${encodeURIComponent(
    project.title
  )}&budget=${encodeURIComponent(budgetFormatted)}&category=${encodeURIComponent(
    project.category || 'Development'
  )}&status=${encodeURIComponent(project.status || 'open')}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: projectUrl,
      siteName: 'TrustPay Escrow',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${project.title} - ${budgetFormatted} Escrow on TrustPay`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
