import { Checklist } from './checklist.entity';
export declare class ChecklistImage {
    id: string;
    checklist_id: string;
    checklist: Checklist;
    image_path: string;
    description: string;
    check_type: string;
    check_item: string;
    created_at: Date;
}
