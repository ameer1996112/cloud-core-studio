-- Allow anonymous users to view classes, instructors, program types, and rooms
CREATE POLICY "Allow anonymous read classes" ON public.classes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read instructors" ON public.instructors FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read program_types" ON public.program_types FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read rooms" ON public.rooms FOR SELECT TO anon USING (true);

-- Ensure anon has select permissions
GRANT SELECT ON public.classes TO anon;
GRANT SELECT ON public.instructors TO anon;
GRANT SELECT ON public.program_types TO anon;
GRANT SELECT ON public.rooms TO anon;
