export interface TemplateDefinition {
  name: string;
  category: string;
  description: string;
  content: string;
  variables: string[];
}

export const builtInTemplates: TemplateDefinition[] = [
  {
    name: "meeting_notes",
    category: "productivity",
    description: "Structured meeting notes with attendees, agenda, and action items",
    content: `# Meeting Notes: {{title}}

**Date:** {{date}}  
**Attendees:** {{attendees}}

## Agenda
{{agenda}}

## Discussion Points
{%if discussion_points%}{{discussion_points}}{%endif%}

## Decisions
{%if decisions%}{{decisions}}{%endif%}

## Action Items
{%for item in action_items%}
- [ ] {{item}}
{%endfor%}

---
*Notes compiled by AgentOS*`,
    variables: ["title", "date", "attendees", "agenda", "discussion_points", "decisions", "action_items"]
  },
  {
    name: "project_status",
    category: "productivity",
    description: "Project status report with milestones, blockers, and next steps",
    content: `# Project Status: {{project_name}}

**Report Date:** {{date}}  
**Status:** {{overall_status}}

## Summary
{{summary}}

## Milestones
{%for milestone in milestones%}
- {{milestone}}
{%endfor%}

## Blockers
{%if blockers%}
{%for blocker in blockers%}
- ⚠️ {{blocker}}
{%endfor%}
{%else%}
No blockers at this time.
{%endif%}

## Next Steps
{%for step in next_steps%}
1. {{step}}
{%endfor%}

## Metrics
- Progress: {{progress_percent}}%
- Budget Used: {{budget_used}}%
- Team Velocity: {{velocity}}`,
    variables: ["project_name", "date", "overall_status", "summary", "milestones", "blockers", "next_steps", "progress_percent", "budget_used", "velocity"]
  },
  {
    name: "comparison_table",
    category: "analysis",
    description: "Side-by-side comparison table for evaluating options",
    content: `# Comparison: {{topic}}

| Criteria | {%for option in options%}{{option}} | {%endfor%}
|----------|{%for option in options%}---|{%endfor%}
{%for criterion in criteria%}
| {{criterion.name}} | {%for option in options%}{{criterion.scores[option]}} | {%endfor%}
{%endfor%}

## Summary
**Winner:** {{winner}}

{{analysis}}`,
    variables: ["topic", "options", "criteria", "winner", "analysis"]
  },
  {
    name: "pros_cons",
    category: "analysis",
    description: "Pros and cons analysis for decision making",
    content: `# Pros/Cons Analysis: {{decision_topic}}

## Pros ✅
{%for pro in pros%}
- {{pro}}
{%endfor%}

## Cons ❌
{%for con in cons%}
- {{con}}
{%endfor%}

## Recommendation
**{{recommendation}}**

{{reasoning}}`,
    variables: ["decision_topic", "pros", "cons", "recommendation", "reasoning"]
  },
  {
    name: "weekly_summary",
    category: "productivity",
    description: "Weekly work summary with accomplishments and plans",
    content: `# Weekly Summary: {{week_ending}}

## Accomplishments 🎯
{%for accomplishment in accomplishments%}
- ✅ {{accomplishment}}
{%endfor%}

## Challenges Faced
{%if challenges%}
{%for challenge in challenges%}
- {{challenge}}
{%endfor%}
{%endif%}

## Time Breakdown
- Development: {{dev_hours}}h
- Meetings: {{meeting_hours}}h
- Planning: {{planning_hours}}h
- Other: {{other_hours}}h

## Goals for Next Week
{%for goal in next_week_goals%}
1. {{goal}}
{%endfor%}

## Notes
{%if notes%}{{notes}}{%endif%}`,
    variables: ["week_ending", "accomplishments", "challenges", "dev_hours", "meeting_hours", "planning_hours", "other_hours", "next_week_goals", "notes"]
  },
  {
    name: "changelog",
    category: "documentation",
    description: "Version changelog with changes, fixes, and improvements",
    content: `# Changelog - Version {{version}}

**Release Date:** {{date}}  
**Author:** {{author}}

## 🚀 New Features
{%for feature in features%}
- {{feature}}
{%endfor%}

## 🐛 Bug Fixes
{%for fix in fixes%}
- Fixed: {{fix}}
{%endfor%}

## 🔧 Improvements
{%for improvement in improvements%}
- {{improvement}}
{%endfor%}

## 📝 Documentation
{%for doc in documentation%}
- {{doc}}
{%endfor%}

## Breaking Changes
{%if breaking_changes%}
⚠️ **Warning:** This version contains breaking changes.
{%for change in breaking_changes%}
- {{change}}
{%endfor%}
{%else%}
No breaking changes in this release.
{%endif%}`,
    variables: ["version", "date", "author", "features", "fixes", "improvements", "documentation", "breaking_changes"]
  },
  {
    name: "document_scaffold",
    category: "documentation",
    description: "Generic document scaffolding with sections",
    content: `# {{title}}

**Created:** {{date}}  
**Author:** {{author}}  
**Version:** {{version}}

## Table of Contents
{%for section in sections%}
- [{{section.title}}](#{{section.anchor}})
{%endfor%}

## Overview
{{overview}}

{%for section in sections%}
## {{section.title}}
{{section.content}}
{%endfor%}

---
*Last updated: {{last_updated}}*`,
    variables: ["title", "date", "author", "version", "sections", "overview", "last_updated"]
  }
];
