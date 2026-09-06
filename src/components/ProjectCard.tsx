import { useNavigate } from 'react-router-dom';
import type { Project } from '../types/database';
import { Badge, projectStatusColor, projectStatusLabel } from './Badge';
import { ProjectProgress } from './ProjectProgress';

interface ProjectCardProps {
  project: Project;
  clientName?: string;
  progress: number;
}

export function ProjectCard({ project, clientName, progress }: ProjectCardProps) {
  const navigate = useNavigate();
  return (
    <div className="project-card" onClick={() => navigate(`/app/projects/${project.id}`)}>
      <div className="flex justify-between items-center">
        <h3 style={{ fontSize: 16 }}>{project.name}</h3>
        <Badge color={projectStatusColor(project.status)}>{projectStatusLabel(project.status)}</Badge>
      </div>
      {clientName && <div className="text-small text-secondary">{clientName}</div>}
      <ProjectProgress percent={progress} />
      {project.due_date && (
        <div className="text-small text-muted">Fecha limite: {project.due_date}</div>
      )}
    </div>
  );
}
