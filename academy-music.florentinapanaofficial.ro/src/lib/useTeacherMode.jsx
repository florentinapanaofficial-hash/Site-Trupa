import { createContext, useContext, useState } from 'react';

const TeacherModeContext = createContext(null);

export function TeacherModeProvider({ children }) {
    const state = useState(true);
    return <TeacherModeContext.Provider value={state}>{children}</TeacherModeContext.Provider>;
}

export function useTeacherMode() {
    const context = useContext(TeacherModeContext);
    if (!context) throw new Error('useTeacherMode necesită TeacherModeProvider.');
    return context;
}
