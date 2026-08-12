UPDATE public.sessions
   SET selected_smp_field_name = 'Stealth. By Design.',
       stage_21_outputs = regexp_replace(
         stage_21_outputs::text,
         'Replace\s+A jaguar never announces itself with\s*-?\s*Stealth\.\s*By Design\.(\s*this speaks to the\s*brand icon but also to the new Jaguar\.)?',
         'Stealth. By Design.', 'gi')::jsonb
 WHERE id = '6ab4ea96-7c3a-4e0a-91a9-24b601752b35';