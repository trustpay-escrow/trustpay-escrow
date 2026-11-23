import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get('title') || 'TrustPay Escrow Project';
    const budget = searchParams.get('budget') || 'Secure Escrow';
    const category = searchParams.get('category') || 'Development';
    const status = searchParams.get('status') || 'Open Escrow';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#09090b',
            padding: '60px',
            fontFamily: 'sans-serif',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          {/* Background Ambient Glow */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(9, 9, 11, 0) 70%)',
              filter: 'blur(40px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '450px',
              height: '450px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(9, 9, 11, 0) 70%)',
              filter: 'blur(40px)',
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Shield Icon SVG */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z"
                  fill="#6366F1"
                />
                <path
                  d="M10 15.5l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4L10 15.5z"
                  fill="#ffffff"
                />
              </svg>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  background: 'linear-gradient(to right, #ffffff, #94a3b8)',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                TRUSTPAY ESCROW
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: '#1e1e24',
                border: '1px solid #312e81',
                color: '#a5b4fc',
                fontSize: '16px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {category} • {status}
            </div>
          </div>

          {/* Project Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 10, maxWidth: '1000px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '12px 24px',
                borderRadius: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(129, 140, 248, 0.3)',
                color: '#818cf8',
                fontSize: '26px',
                fontWeight: 900,
              }}
            >
              💰 {budget}
            </div>

            <h1
              style={{
                fontSize: title.length > 50 ? '42px' : '52px',
                fontWeight: 900,
                lineHeight: 1.15,
                color: '#ffffff',
                margin: 0,
              }}
            >
              {title}
            </h1>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '24px',
              borderTop: '1px solid #27272a',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '18px' }}>
              <span>⚡ Stellar Soroban Smart Contract</span>
              <span>•</span>
              <span>Non-Custodial Milestone Payments</span>
            </div>
            <div style={{ color: '#6366f1', fontSize: '18px', fontWeight: 700 }}>
              trustpay-escrow.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate OpenGraph image: ${e.message}`, { status: 500 });
  }
}
