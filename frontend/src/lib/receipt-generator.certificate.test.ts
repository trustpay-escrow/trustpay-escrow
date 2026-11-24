import { describe, expect, it } from 'vitest';
import {
  buildCertificateSvg,
  escapeXml,
  getCertificateFilename,
  getCertificateVerificationUrl,
  type MilestoneCertificateData,
} from './receipt-generator';

const TX_HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0';

const baseData: MilestoneCertificateData = {
  projectTitle: 'DeFi Dashboard Redesign',
  milestoneTitle: 'Final delivery & handoff',
  milestoneIndex: 2,
  amount: 1250.5,
  token: 'USDC',
  freelancerAddress: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
  txHash: TX_HASH,
  issuedAt: '2026-11-24T12:00:00.000Z',
};

describe('buildCertificateSvg (#310)', () => {
  it('produces a valid SVG document with certificate details', () => {
    const svg = buildCertificateSvg(baseData);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('Certificate of Completion');
    expect(svg).toContain('TRUSTPAY');
    expect(svg).toContain('DeFi Dashboard Redesign');
    expect(svg).toContain('#2 · Final delivery &amp; handoff');
    expect(svg).toContain('1,250.50 USDC');
    expect(svg).toContain('GC26DUXYW7PKP5N6WA5M');
    expect(svg).toContain('C4PUZ73CMIB5');
  });

  it('embeds a scannable QR pointing at the Stellar Expert transaction', () => {
    const svg = buildCertificateSvg(baseData);

    // The QR is rendered as a single vector path inside the verification group.
    expect(svg).toMatch(/<path d="M[\d.]+ [\d.]+h[\d.]+v[\d.]+/);
    expect(svg).toContain('stellar.expert');
    expect(svg).toContain(TX_HASH.slice(0, 10));
  });

  it('escapes untrusted project metadata before inlining it in markup', () => {
    const svg = buildCertificateSvg({
      ...baseData,
      projectTitle: '<script>alert("xss")</script> & Co',
    });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp; Co');
    expect(escapeXml('"\'<>&')).toBe('&quot;&apos;&lt;&gt;&amp;');
  });

  it('falls back to the contract explorer when no transaction hash exists', () => {
    const url = getCertificateVerificationUrl({
      ...baseData,
      txHash: undefined,
      contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    });

    expect(url).toContain('stellar.expert');
    expect(url).toContain('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
  });

  it('creates a slugged, printable filename', () => {
    expect(getCertificateFilename(baseData)).toBe(
      'trustpay-certificate-defi-dashboard-redesign-final-delivery-handoff.svg'
    );
    expect(getCertificateFilename(baseData, 'pdf')).toMatch(/\.pdf$/);
  });
});
