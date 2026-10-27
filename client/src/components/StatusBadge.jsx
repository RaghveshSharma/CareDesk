import React from 'react';
import { Calendar, UserCheck, Stethoscope, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  booked: {
    label: 'Booked',
    icon: Calendar,
    className: 'badge-booked',
  },
  checked_in: {
    label: 'Checked In',
    icon: UserCheck,
    className: 'badge-checked_in',
  },
  in_consultation: {
    label: 'In Consultation',
    icon: Stethoscope,
    className: 'badge-in_consultation',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'badge-completed',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'badge-cancelled',
  },
  no_show: {
    label: 'No Show',
    icon: Clock,
    className: 'badge-no_show',
  },
};

export const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    icon: Calendar,
    className: 'badge-booked',
  };

  const Icon = config.icon;

  return (
    <span className={`badge ${config.className}`}>
      <span className="badge-dot" />
      <Icon size={12} />
      <span>{config.label}</span>
    </span>
  );
};
