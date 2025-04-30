// export interface Memory {
//     meeting_id: string;
//     meeting_title: string;
//     time_created: string;
//     summary: string;
//     action: string;
//     duration?: string;
//     name?: string;
//   }


// Memory will be the top level interface
export interface Memory {
    summary: Summary;
    note?: Note;
  }

// Memories have details like
interface Summary {
    keywords?: string;
    meeting_title?: string;
    summary?: string;
    time_created?: Date;
    meeting_id?: string;
    summary_id?: string;
    share?:boolean;
    transcript?:string; 
    attendees?:string[];
    start_time_local:Date;
    end_time_local?:Date;
    action?:string;
}

// May or may not have notes
interface Note {
    notes?:string;
}
