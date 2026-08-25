import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IssueItem {
  id: string;
  title: string;
  summary: string;
  background: string;
  proposedSolution: string;
  filesLikelyAffected: string[];
  acceptanceCriteria: string[];
  testingRequirements: string;
  category: string;
  milestone: string;
  complexity: string;
  points: number;
  labels: string[];
}

async function publishToGitHub(owner: string, repo: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ Error: Set GITHUB_TOKEN environment variable before running this script.');
    console.error('Example: export GITHUB_TOKEN="ghp_xxxx"');
    process.exit(1);
  }

  const jsonPath = path.resolve(__dirname, '../docs/drips-wave-issues.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Error: Could not find issue dataset at ${jsonPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const issues: IssueItem[] = JSON.parse(rawData);

  console.log(`🚀 Starting publication of ${issues.length} Drips Wave issues to ${owner}/${repo}...`);

  let count = 0;
  let totalPoints = 0;

  for (const issue of issues) {
    count++;
    totalPoints += issue.points;

    const body = `## 📌 Summary
${issue.summary}

### 📖 Background & Problem
${issue.background}

### 💡 Proposed Solution
${issue.proposedSolution}

### 📂 Files Likely Affected
${issue.filesLikelyAffected.map((f) => `- \`${f}\``).join('\n')}

### ✅ Acceptance Criteria
${issue.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')}

### 🧪 Testing Requirements
${issue.testingRequirements}

---

### 🌊 Drips Wave Classification
- **Category:** \`${issue.category}\`
- **Milestone:** \`${issue.milestone}\`
- **Complexity:** \`${issue.complexity}\`
- **Drips Wave Allocation:** **${issue.points} Points**`;

    console.log(`[${count}/${issues.length}] Publishing: ${issue.title} (${issue.points} Pts)...`);

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Drips-Wave-Publisher'
        },
        body: JSON.stringify({
          title: issue.title,
          body,
          labels: issue.labels
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`⚠️ Failed to publish issue "${issue.title}":`, errorText);
      } else {
        const resData = await response.json() as { html_url: string };
        console.log(`   ✅ Published: ${resData.html_url}`);
      }
    } catch (err) {
      console.error(`❌ Network error publishing issue "${issue.title}":`, err);
    }

    // Delay to respect GitHub API rate limits
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  console.log(`\n🎉 Successfully finished publishing backlog!`);
  console.log(`📊 Published ${count} issues totaling ${totalPoints} Drips Wave Points.`);
}

// Read CLI args or environment defaults
const targetOwner = process.argv[2] || process.env.GITHUB_OWNER || 'OluwapelumiElisha';
const targetRepo = process.argv[3] || process.env.GITHUB_REPO || 'trustpay-escrow';

publishToGitHub(targetOwner, targetRepo);
