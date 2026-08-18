## Description: <br>
TranscriptAPI helps agents retrieve YouTube transcripts and related video, channel, playlist, and search data through TranscriptAPI.com. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[therohitdas](https://clawhub.ai/user/therohitdas) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
Developers, researchers, and end users use this skill when an agent needs YouTube transcript retrieval, video search, channel browsing, playlist inspection, or summarization support from video content. It is not intended for YouTube uploads, account management, or written-source-only research. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: YouTube queries and related API requests are sent to the third-party TranscriptAPI service. <br>
Mitigation: Use the skill only for content that can be shared with that service, and avoid sending sensitive private context in request parameters. <br>
Risk: The setup flow may involve creating an account, handling OTPs, and storing a TranscriptAPI API key. <br>
Mitigation: Create the account yourself when possible, provide the key through an approved secret manager, and avoid persistent shell-profile storage unless it matches the local environment policy. <br>


## Reference(s): <br>
- [TranscriptAPI homepage](https://transcriptapi.com) <br>
- [TranscriptAPI OpenAPI specification](https://transcriptapi.com/openapi.json) <br>
- [TranscriptAPI authentication setup](references/auth-setup.md) <br>
- [ClawHub skill page](https://clawhub.ai/therohitdas/skills/transcriptapi) <br>


## Skill Output: <br>
**Output Type(s):** [Guidance, Shell commands, API calls, Configuration] <br>
**Output Format:** [Markdown with curl examples and JSON response examples] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Requires internet access, a TRANSCRIPT_API_KEY secret, and a User-Agent header; requests are sent to the third-party TranscriptAPI service.] <br>

## Skill Version(s): <br>
1.5.0 (source: frontmatter and server release evidence) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
