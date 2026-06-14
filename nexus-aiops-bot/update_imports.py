import os

replacements = {
    'import DashboardLayout from "@/components/DashboardLayout";': 'import DashboardLayout from "@/components/layout/DashboardLayout";',
    'import MarkdownRenderer from "@/components/MarkdownRenderer";': 'import MarkdownRenderer from "@/components/common/MarkdownRenderer";',
    'import MermaidDiagram from "@/components/MermaidDiagram";': 'import MermaidDiagram from "@/components/common/MermaidDiagram";',
    'import KubernetesPanel from "@/components/KubernetesPanel";': 'import AksWorkloadSummary from "@/components/azure/aks/AksWorkloadSummary";',
    '<KubernetesPanel': '<AksWorkloadSummary'
}

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            modified = True
            
    if modified:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.js'):
            update_file(os.path.join(root, file))
