insert into public.repositories (slug,title,intro) values
('jaguar-source-research','Jaguar — Source Research Archive','Internal archive. Full attributed corpus produced by the Research Synthesiser run applied to the Jaguar Intelligence Lab session on 10 August 2026. The original uploaded source files were not retained by the platform; this is the highest-fidelity surviving record of that material.')
on conflict (slug) do update set title=excluded.title, intro=excluded.intro;

insert into public.repository_documents (repository_slug,title,description,storage_path,file_type,display_order) values
('jaguar-source-research','Jaguar — Research Synthesiser Attributed Corpus','258 attributed claim entries across six intelligence fields, each retaining source document, verification status and verification note. Run 584d3f8c, applied 10 Aug 2026.','jaguar-source-research/2f0a7c31-9b44-4d3e-8c62-5a1de9f0b7aa-Jaguar_Research_Synthesiser_Attributed_Corpus.pdf','pdf',1);