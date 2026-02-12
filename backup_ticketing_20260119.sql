--
-- PostgreSQL database dump
--

\restrict c6EJwck90Y7zKOGAV3MeylDTF9xqFwygTbTRIE2oGhUSGVfWZ36OvP2MC5PRHEd

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: ticketing_app
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO ticketing_app;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: ticketing_app
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: ticketing_app
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO ticketing_app;

--
-- Name: bot_trainings; Type: TABLE; Schema: public; Owner: ticketing_app
--

CREATE TABLE public.bot_trainings (
    id integer NOT NULL,
    text text NOT NULL,
    category text NOT NULL,
    response text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.bot_trainings OWNER TO ticketing_app;

--
-- Name: bot_trainings_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing_app
--

CREATE SEQUENCE public.bot_trainings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bot_trainings_id_seq OWNER TO ticketing_app;

--
-- Name: bot_trainings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing_app
--

ALTER SEQUENCE public.bot_trainings_id_seq OWNED BY public.bot_trainings.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: ticketing_app
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    "ticketId" integer NOT NULL,
    sender text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.chat_messages OWNER TO ticketing_app;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing_app
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO ticketing_app;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing_app
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: ticketing_app
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text,
    status text DEFAULT 'open'::text NOT NULL,
    "userId" integer NOT NULL,
    address text,
    "mapsLink" text,
    "autoResolved" boolean DEFAULT false NOT NULL,
    "resolvedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tickets OWNER TO ticketing_app;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing_app
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO ticketing_app;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing_app
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: ticketing_app
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    name text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'customer'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    address text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO ticketing_app;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing_app
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO ticketing_app;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing_app
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: bot_trainings id; Type: DEFAULT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.bot_trainings ALTER COLUMN id SET DEFAULT nextval('public.bot_trainings_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: ticketing_app
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b5bee5aa-f33a-4f54-a6f2-034658b7361e	6b8cfa24b044b30336b52feee0a02c196b067947f9a9ccb192f5c38cfbc43bf5	2025-12-28 16:02:00.886605+07	20251224042107_init	\N	\N	2025-12-28 16:02:00.77428+07	1
caf12410-7f4a-460b-86ef-933685e1b97b	2e7dbc29eaa3407c75d9c4a42e13256310dadade9770146fec98044e771a184a	2025-12-28 16:02:18.666437+07	20251228090218_final_schema_with_auth	\N	\N	2025-12-28 16:02:18.566521+07	1
23fe6a27-62f4-4ea8-88b4-cd01f0ca5319	f0b8fb704153425282c6c352be9d44d012c07abea5ad667080192c127573e527	2025-12-28 22:50:58.564341+07	20251228155058_fix_schema_improvements	\N	\N	2025-12-28 22:50:58.426688+07	1
\.


--
-- Data for Name: bot_trainings; Type: TABLE DATA; Schema: public; Owner: ticketing_app
--

COPY public.bot_trainings (id, text, category, response, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: ticketing_app
--

COPY public.chat_messages (id, "ticketId", sender, message, "createdAt") FROM stdin;
1	1	customer	halo	2026-01-05 13:18:02.601
2	1	customer	halo	2026-01-05 13:19:43.111
3	1	admin	halo	2026-01-05 14:12:25.903
4	1	admin	halo ini admin	2026-01-05 14:13:11.509
5	1	admin	hai	2026-01-05 14:13:23.812
6	1	customer	halo juga	2026-01-05 14:16:23.387
7	1	admin	halo ini admin	2026-01-05 14:16:42.199
8	1	customer	halo min	2026-01-05 14:16:49.308
9	1	customer	halo	2026-01-05 14:40:20.787
10	1	customer	gahah	2026-01-05 14:41:01.318
11	1	customer	haloo	2026-01-14 05:04:53.127
12	1	customer	hai	2026-01-14 05:05:58.561
13	1	admin	halo	2026-01-18 18:41:02.889
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: ticketing_app
--

COPY public.tickets (id, title, description, category, status, "userId", address, "mapsLink", "autoResolved", "resolvedBy", "createdAt", "updatedAt") FROM stdin;
1	gangguan jaringan	internet mati	\N	open	2	Ds. Ngadirejo RT 20 RW 09 Kec. Wonoasri Kab. Madiun	https://www.google.com/maps/search/?api=1&query=Ds.%20Ngadirejo%20RT%2020%20RW%2009%20Kec.%20Wonoasri%20Kab.%20Madiun	f	\N	2026-01-05 13:17:06.021	2026-01-18 17:58:42.96
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ticketing_app
--

COPY public.users (id, username, name, password, role, status, address, "createdAt", "updatedAt") FROM stdin;
1	admin	Administrator	$2b$10$yAwRxxXh5rMgbPsUC1UjJu8qF/D/WUDQqpk8NZwgGGWypFou.ejUS	admin	active	\N	2026-01-05 12:33:44.584	2026-01-05 12:33:44.584
2	ciptaranggabalongkore	Cipta Rangga Wijaya	$2b$10$ud4xhWOZgKWcKO91SjhMbeQqSVmrT.AF56yGgE.3ddxL/vrxC6ozK	customer	active	Ds. Ngadirejo RT 20 RW 09 Kec. Wonoasri Kab. Madiun	2026-01-05 12:34:30.672	2026-01-05 12:34:30.672
\.


--
-- Name: bot_trainings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing_app
--

SELECT pg_catalog.setval('public.bot_trainings_id_seq', 1, false);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing_app
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 13, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing_app
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing_app
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: bot_trainings bot_trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.bot_trainings
    ADD CONSTRAINT bot_trainings_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: bot_trainings_category_idx; Type: INDEX; Schema: public; Owner: ticketing_app
--

CREATE INDEX bot_trainings_category_idx ON public.bot_trainings USING btree (category);


--
-- Name: chat_messages_ticketId_idx; Type: INDEX; Schema: public; Owner: ticketing_app
--

CREATE INDEX "chat_messages_ticketId_idx" ON public.chat_messages USING btree ("ticketId");


--
-- Name: tickets_status_idx; Type: INDEX; Schema: public; Owner: ticketing_app
--

CREATE INDEX tickets_status_idx ON public.tickets USING btree (status);


--
-- Name: tickets_userId_idx; Type: INDEX; Schema: public; Owner: ticketing_app
--

CREATE INDEX "tickets_userId_idx" ON public.tickets USING btree ("userId");


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: ticketing_app
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: chat_messages chat_messages_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "chat_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tickets tickets_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing_app
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: ticketing_app
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict c6EJwck90Y7zKOGAV3MeylDTF9xqFwygTbTRIE2oGhUSGVfWZ36OvP2MC5PRHEd

