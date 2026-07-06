--
-- PostgreSQL database dump
--

\restrict b4zKQlzpM2hK0jZdtVoh3gw2AZKLJpiterQncW7ZN2C0fvoxjTAgynWKLgdvT0Y

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.10 (Homebrew)

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

ALTER TABLE IF EXISTS ONLY public.item DROP CONSTRAINT IF EXISTS item_parent_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.item_embedding DROP CONSTRAINT IF EXISTS item_embedding_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.item_feature DROP CONSTRAINT IF EXISTS item_feature_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.item_feature DROP CONSTRAINT IF EXISTS item_feature_feature_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_selection DROP CONSTRAINT IF EXISTS fk_user_selection_item;
ALTER TABLE IF EXISTS ONLY public.sales_lead_user_selection DROP CONSTRAINT IF EXISTS fk_sales_lead_user_selection_selection;
ALTER TABLE IF EXISTS ONLY public.sales_lead_user_selection DROP CONSTRAINT IF EXISTS fk_sales_lead_user_selection_lead;
ALTER TABLE IF EXISTS ONLY public.product DROP CONSTRAINT IF EXISTS fk_product_target_audience;
ALTER TABLE IF EXISTS ONLY public.product_feature DROP CONSTRAINT IF EXISTS fk_product_feature_product;
ALTER TABLE IF EXISTS ONLY public.product_feature DROP CONSTRAINT IF EXISTS fk_product_feature_feature;
ALTER TABLE IF EXISTS ONLY public.product DROP CONSTRAINT IF EXISTS fk_product_category;
ALTER TABLE IF EXISTS ONLY public.chat_sessions DROP CONSTRAINT IF EXISTS fk_chat_sessions_user;
ALTER TABLE IF EXISTS ONLY public.chat_conversations DROP CONSTRAINT IF EXISTS fk_chat_conversations_session;
DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS trigger_update_product_search_vector ON public.product;
DROP TRIGGER IF EXISTS trigger_update_feature_search_vector ON public.feature;
DROP TRIGGER IF EXISTS trigger_target_audience_updated_at ON public.target_audience;
DROP TRIGGER IF EXISTS trigger_sales_lead_updated_at ON public.sales_lead;
DROP TRIGGER IF EXISTS trigger_product_updated_at ON public.product;
DROP TRIGGER IF EXISTS trigger_product_category_updated_at ON public.product_category;
DROP TRIGGER IF EXISTS trigger_feature_updated_at ON public.feature;
DROP TRIGGER IF EXISTS item_search_vector_update_trigger ON public.item;
DROP INDEX IF EXISTS public.uq_user_selection_session_item;
DROP INDEX IF EXISTS public.item_search_vector_idx;
DROP INDEX IF EXISTS public.idx_user_selection_session;
DROP INDEX IF EXISTS public.idx_user_selection_product;
DROP INDEX IF EXISTS public.idx_user_selection_item;
DROP INDEX IF EXISTS public.idx_user_selection_expires_at;
DROP INDEX IF EXISTS public.idx_user_selection_created_at;
DROP INDEX IF EXISTS public.idx_sales_lead_status;
DROP INDEX IF EXISTS public.idx_sales_lead_salesforce_id;
DROP INDEX IF EXISTS public.idx_sales_lead_email;
DROP INDEX IF EXISTS public.idx_sales_lead_created_at;
DROP INDEX IF EXISTS public.idx_product_target_audience;
DROP INDEX IF EXISTS public.idx_product_search_vector;
DROP INDEX IF EXISTS public.idx_product_price;
DROP INDEX IF EXISTS public.idx_product_category;
DROP INDEX IF EXISTS public.idx_item_type;
DROP INDEX IF EXISTS public.idx_item_target_audience;
DROP INDEX IF EXISTS public.idx_item_parent;
DROP INDEX IF EXISTS public.idx_item_name;
DROP INDEX IF EXISTS public.idx_item_active;
DROP INDEX IF EXISTS public.idx_feature_search_vector;
DROP INDEX IF EXISTS public.idx_chat_sessions_user_id;
DROP INDEX IF EXISTS public.idx_chat_sessions_session_id;
DROP INDEX IF EXISTS public.idx_chat_sessions_last_activity;
DROP INDEX IF EXISTS public.idx_chat_conversations_session;
DROP INDEX IF EXISTS public.idx_chat_conversations_created_at;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_selection DROP CONSTRAINT IF EXISTS user_selection_pkey;
ALTER TABLE IF EXISTS ONLY public.user_selection DROP CONSTRAINT IF EXISTS uq_user_selection_session_product;
ALTER TABLE IF EXISTS ONLY public.sales_lead DROP CONSTRAINT IF EXISTS uq_sales_lead_salesforce_id;
ALTER TABLE IF EXISTS ONLY public.target_audience DROP CONSTRAINT IF EXISTS target_audience_pkey;
ALTER TABLE IF EXISTS ONLY public.target_audience DROP CONSTRAINT IF EXISTS target_audience_name_key;
ALTER TABLE IF EXISTS ONLY public.session_cleanup_logs DROP CONSTRAINT IF EXISTS session_cleanup_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.sales_lead_user_selection DROP CONSTRAINT IF EXISTS sales_lead_user_selection_pkey;
ALTER TABLE IF EXISTS ONLY public.sales_lead DROP CONSTRAINT IF EXISTS sales_lead_pkey;
ALTER TABLE IF EXISTS ONLY public.product DROP CONSTRAINT IF EXISTS product_pkey;
ALTER TABLE IF EXISTS ONLY public.product_feature DROP CONSTRAINT IF EXISTS product_feature_pkey;
ALTER TABLE IF EXISTS ONLY public.product_category DROP CONSTRAINT IF EXISTS product_category_pkey;
ALTER TABLE IF EXISTS ONLY public.product_category DROP CONSTRAINT IF EXISTS product_category_name_key;
ALTER TABLE IF EXISTS ONLY public.item DROP CONSTRAINT IF EXISTS item_pkey;
ALTER TABLE IF EXISTS ONLY public.item_embedding DROP CONSTRAINT IF EXISTS item_embedding_pkey;
ALTER TABLE IF EXISTS ONLY public.item_feature DROP CONSTRAINT IF EXISTS item_feature_pkey;
ALTER TABLE IF EXISTS ONLY public.feature DROP CONSTRAINT IF EXISTS feature_pkey;
ALTER TABLE IF EXISTS ONLY public.feature DROP CONSTRAINT IF EXISTS feature_name_key;
ALTER TABLE IF EXISTS ONLY public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_session_id_key;
ALTER TABLE IF EXISTS ONLY public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_pkey;
ALTER TABLE IF EXISTS public.user_selection ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.target_audience ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.session_cleanup_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.sales_lead ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.product_category ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.product ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.item ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.feature ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.chat_sessions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.chat_conversations ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.user_selection_id_seq;
DROP VIEW IF EXISTS public.user_selection_details;
DROP TABLE IF EXISTS public.user_selection;
DROP SEQUENCE IF EXISTS public.target_audience_id_seq;
DROP SEQUENCE IF EXISTS public.session_cleanup_logs_id_seq;
DROP TABLE IF EXISTS public.session_cleanup_logs;
DROP TABLE IF EXISTS public.sales_lead_user_selection;
DROP SEQUENCE IF EXISTS public.sales_lead_id_seq;
DROP TABLE IF EXISTS public.sales_lead;
DROP SEQUENCE IF EXISTS public.product_id_seq;
DROP TABLE IF EXISTS public.product_feature;
DROP TABLE IF EXISTS public.item_feature;
DROP VIEW IF EXISTS public.product_details;
DROP TABLE IF EXISTS public.target_audience;
DROP SEQUENCE IF EXISTS public.product_category_id_seq;
DROP TABLE IF EXISTS public.product_category;
DROP TABLE IF EXISTS public.product;
DROP SEQUENCE IF EXISTS public.item_id_seq;
DROP TABLE IF EXISTS public.item_embedding;
DROP TABLE IF EXISTS public.item;
DROP SEQUENCE IF EXISTS public.feature_id_seq;
DROP TABLE IF EXISTS public.feature;
DROP SEQUENCE IF EXISTS public.chat_sessions_id_seq;
DROP TABLE IF EXISTS public.chat_sessions;
DROP SEQUENCE IF EXISTS public.chat_conversations_id_seq;
DROP TABLE IF EXISTS public.chat_conversations;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.update_product_search_vector();
DROP FUNCTION IF EXISTS public.update_feature_search_vector();
DROP FUNCTION IF EXISTS public.item_search_vector_update();
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
DROP EXTENSION IF EXISTS vector;
DROP EXTENSION IF EXISTS "uuid-ossp";
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: cleanup_expired_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_sessions() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
  idle_cutoff TIMESTAMP;
  absolute_cutoff TIMESTAMP;
BEGIN
  idle_cutoff := NOW() - INTERVAL '30 minutes';
  absolute_cutoff := NOW() - INTERVAL '4 hours';
  
  DELETE FROM chat_sessions
  WHERE last_activity_at < idle_cutoff
     OR created_at < absolute_cutoff;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Create logging table if it doesn't exist
  CREATE TABLE IF NOT EXISTS session_cleanup_logs (
    id SERIAL PRIMARY KEY,
    deleted_count INTEGER NOT NULL,
    idle_cutoff TIMESTAMP NOT NULL,
    absolute_cutoff TIMESTAMP NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
  );

  INSERT INTO session_cleanup_logs (deleted_count, idle_cutoff, absolute_cutoff)
  VALUES (deleted_count, idle_cutoff, absolute_cutoff);

  RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
END;
$$;


--
-- Name: item_search_vector_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.item_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;


--
-- Name: update_feature_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_feature_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$;


--
-- Name: update_product_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.contract_term, '')), 'C');
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    user_message text NOT NULL,
    bot_response text NOT NULL,
    extracted_entities jsonb,
    recommended_products jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE chat_conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_conversations IS 'Individual chat messages and AI responses';


--
-- Name: chat_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_conversations_id_seq OWNED BY public.chat_conversations.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    user_id uuid,
    user_preferences jsonb,
    conversation_context text,
    last_activity_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE chat_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_sessions IS 'Chat session tracking with user preferences';


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_sessions_id_seq OWNED BY public.chat_sessions.id;


--
-- Name: feature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector
);


--
-- Name: TABLE feature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feature IS 'Features that can be associated with products';


--
-- Name: feature_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feature_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feature_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feature_id_seq OWNED BY public.feature.id;


--
-- Name: item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    item_type character varying(50) NOT NULL,
    parent_item_id integer,
    price numeric(10,2),
    contract_term character varying(255),
    target_audience_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    search_vector tsvector
);


--
-- Name: item_embedding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_embedding (
    item_id integer NOT NULL,
    embedding public.vector(768) NOT NULL,
    model character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: item_feature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_feature (
    item_id integer NOT NULL,
    feature_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_id_seq OWNED BY public.item.id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    target_audience_id integer NOT NULL,
    product_category_id integer NOT NULL,
    price numeric(10,2),
    contract_term character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector
);


--
-- Name: TABLE product; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product IS 'Main product catalog with pricing and details';


--
-- Name: product_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE product_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_category IS 'Product categories such as Data, DIA, Fiber Broadband';


--
-- Name: product_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_category_id_seq OWNED BY public.product_category.id;


--
-- Name: target_audience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.target_audience (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE target_audience; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.target_audience IS 'Customer segments like Hospitality, Enterprise, Banking';


--
-- Name: product_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.product_details AS
 SELECT p.id,
    p.name,
    p.description,
    p.price,
    p.contract_term,
    ta.name AS target_audience,
    pc.name AS product_category,
    pc.description AS category_description
   FROM ((public.product p
     JOIN public.target_audience ta ON ((p.target_audience_id = ta.id)))
     JOIN public.product_category pc ON ((p.product_category_id = pc.id)));


--
-- Name: product_feature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_feature (
    product_id integer NOT NULL,
    feature_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE product_feature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_feature IS 'Many-to-many relationship between products and features';


--
-- Name: product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;


--
-- Name: sales_lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_lead (
    id integer NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255) NOT NULL,
    customer_phone character varying(255) NOT NULL,
    salesforce_lead_id character varying(255),
    status character varying(50) DEFAULT 'New'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sales_lead_status CHECK (((status)::text = ANY ((ARRAY['New'::character varying, 'Synced'::character varying, 'Error'::character varying, 'Processing'::character varying])::text[])))
);


--
-- Name: TABLE sales_lead; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sales_lead IS 'Sales leads with Salesforce integration';


--
-- Name: sales_lead_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_lead_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_lead_id_seq OWNED BY public.sales_lead.id;


--
-- Name: sales_lead_user_selection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_lead_user_selection (
    sales_lead_id integer NOT NULL,
    user_selection_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE sales_lead_user_selection; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sales_lead_user_selection IS 'Links sales leads to their selected products';


--
-- Name: session_cleanup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_cleanup_logs (
    id integer NOT NULL,
    deleted_count integer NOT NULL,
    idle_cutoff timestamp without time zone NOT NULL,
    absolute_cutoff timestamp without time zone NOT NULL,
    executed_at timestamp without time zone DEFAULT now()
);


--
-- Name: session_cleanup_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_cleanup_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_cleanup_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_cleanup_logs_id_seq OWNED BY public.session_cleanup_logs.id;


--
-- Name: target_audience_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.target_audience_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: target_audience_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.target_audience_id_seq OWNED BY public.target_audience.id;


--
-- Name: user_selection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_selection (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    product_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone GENERATED ALWAYS AS ((created_at + '30 days'::interval)) STORED,
    item_id integer,
    CONSTRAINT user_selection_has_id_check CHECK (((product_id IS NOT NULL) OR (item_id IS NOT NULL)))
);


--
-- Name: TABLE user_selection; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_selection IS 'User shopping cart/selection tracking by session';


--
-- Name: user_selection_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_selection_details AS
 SELECT us.id AS selection_id,
    us.session_id,
    us.created_at AS selected_at,
    p.id AS product_id,
    p.name AS product_name,
    p.price,
    ta.name AS target_audience,
    pc.name AS product_category
   FROM (((public.user_selection us
     JOIN public.product p ON ((us.product_id = p.id)))
     JOIN public.target_audience ta ON ((p.target_audience_id = ta.id)))
     JOIN public.product_category pc ON ((p.product_category_id = pc.id)));


--
-- Name: user_selection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_selection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_selection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_selection_id_seq OWNED BY public.user_selection.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255),
    name character varying(255),
    phone character varying(20),
    user_type character varying(50) DEFAULT 'anonymous'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'User management for authenticated and anonymous users';


--
-- Name: chat_conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations ALTER COLUMN id SET DEFAULT nextval('public.chat_conversations_id_seq'::regclass);


--
-- Name: chat_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions ALTER COLUMN id SET DEFAULT nextval('public.chat_sessions_id_seq'::regclass);


--
-- Name: feature id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature ALTER COLUMN id SET DEFAULT nextval('public.feature_id_seq'::regclass);


--
-- Name: item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item ALTER COLUMN id SET DEFAULT nextval('public.item_id_seq'::regclass);


--
-- Name: product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);


--
-- Name: product_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category ALTER COLUMN id SET DEFAULT nextval('public.product_category_id_seq'::regclass);


--
-- Name: sales_lead id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_lead ALTER COLUMN id SET DEFAULT nextval('public.sales_lead_id_seq'::regclass);


--
-- Name: session_cleanup_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_cleanup_logs ALTER COLUMN id SET DEFAULT nextval('public.session_cleanup_logs_id_seq'::regclass);


--
-- Name: target_audience id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.target_audience ALTER COLUMN id SET DEFAULT nextval('public.target_audience_id_seq'::regclass);


--
-- Name: user_selection id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_selection ALTER COLUMN id SET DEFAULT nextval('public.user_selection_id_seq'::regclass);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_session_id_key UNIQUE (session_id);


--
-- Name: feature feature_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature
    ADD CONSTRAINT feature_name_key UNIQUE (name);


--
-- Name: feature feature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature
    ADD CONSTRAINT feature_pkey PRIMARY KEY (id);


--
-- Name: item_embedding item_embedding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_embedding
    ADD CONSTRAINT item_embedding_pkey PRIMARY KEY (item_id);


--
-- Name: item item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item
    ADD CONSTRAINT item_pkey PRIMARY KEY (id);


--
-- Name: product_category product_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_name_key UNIQUE (name);


--
-- Name: product_category product_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_pkey PRIMARY KEY (id);


--
-- Name: item_feature item_feature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_feature
    ADD CONSTRAINT item_feature_pkey PRIMARY KEY (item_id, feature_id);


--
-- Name: product_feature product_feature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_feature
    ADD CONSTRAINT product_feature_pkey PRIMARY KEY (product_id, feature_id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: sales_lead sales_lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_lead
    ADD CONSTRAINT sales_lead_pkey PRIMARY KEY (id);


--
-- Name: sales_lead_user_selection sales_lead_user_selection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_lead_user_selection
    ADD CONSTRAINT sales_lead_user_selection_pkey PRIMARY KEY (sales_lead_id, user_selection_id);


--
-- Name: session_cleanup_logs session_cleanup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_cleanup_logs
    ADD CONSTRAINT session_cleanup_logs_pkey PRIMARY KEY (id);


--
-- Name: target_audience target_audience_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.target_audience
    ADD CONSTRAINT target_audience_name_key UNIQUE (name);


--
-- Name: target_audience target_audience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.target_audience
    ADD CONSTRAINT target_audience_pkey PRIMARY KEY (id);


--
-- Name: sales_lead uq_sales_lead_salesforce_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_lead
    ADD CONSTRAINT uq_sales_lead_salesforce_id UNIQUE (salesforce_lead_id);


--
-- Name: user_selection uq_user_selection_session_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_selection
    ADD CONSTRAINT uq_user_selection_session_product UNIQUE (session_id, product_id);


--
-- Name: user_selection user_selection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_selection
    ADD CONSTRAINT user_selection_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_conversations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversations_created_at ON public.chat_conversations USING btree (created_at);


--
-- Name: idx_chat_conversations_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversations_session ON public.chat_conversations USING btree (session_id);


--
-- Name: idx_chat_sessions_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_last_activity ON public.chat_sessions USING btree (last_activity_at);


--
-- Name: idx_chat_sessions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_session_id ON public.chat_sessions USING btree (session_id);


--
-- Name: idx_chat_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);


--
-- Name: idx_feature_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_search_vector ON public.feature USING gin (search_vector);


--
-- Name: idx_item_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_active ON public.item USING btree (is_active);


--
-- Name: idx_item_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_name ON public.item USING btree (name);


--
-- Name: idx_item_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_parent ON public.item USING btree (parent_item_id);


--
-- Name: idx_item_target_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_target_audience ON public.item USING btree (target_audience_id);


--
-- Name: idx_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_type ON public.item USING btree (item_type);


--
-- Name: idx_product_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_category ON public.product USING btree (product_category_id);


--
-- Name: idx_product_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_price ON public.product USING btree (price);


--
-- Name: idx_product_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_search_vector ON public.product USING gin (search_vector);


--
-- Name: idx_product_target_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_target_audience ON public.product USING btree (target_audience_id);


--
-- Name: idx_sales_lead_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_lead_created_at ON public.sales_lead USING btree (created_at);


--
-- Name: idx_sales_lead_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_lead_email ON public.sales_lead USING btree (customer_email);


--
-- Name: idx_sales_lead_salesforce_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_lead_salesforce_id ON public.sales_lead USING btree (salesforce_lead_id);


--
-- Name: idx_sales_lead_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_lead_status ON public.sales_lead USING btree (status);


--
-- Name: idx_user_selection_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_selection_created_at ON public.user_selection USING btree (created_at);


--
-- Name: idx_user_selection_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_selection_expires_at ON public.user_selection USING btree (expires_at);


--
-- Name: idx_user_selection_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_selection_item ON public.user_selection USING btree (item_id);


--
-- Name: idx_user_selection_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_selection_product ON public.user_selection USING btree (product_id);


--
-- Name: idx_user_selection_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_selection_session ON public.user_selection USING btree (session_id);


--
-- Name: item_search_vector_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX item_search_vector_idx ON public.item USING gin (search_vector);


--
-- Name: uq_user_selection_session_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uq_user_selection_session_item ON public.user_selection USING btree (session_id, item_id);


--
-- Name: item item_search_vector_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER item_search_vector_update_trigger BEFORE INSERT OR UPDATE ON public.item FOR EACH ROW EXECUTE FUNCTION public.item_search_vector_update();


--
-- Name: feature trigger_feature_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_feature_updated_at BEFORE UPDATE ON public.feature FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_category trigger_product_category_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_product_category_updated_at BEFORE UPDATE ON public.product_category FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product trigger_product_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_product_updated_at BEFORE UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_lead trigger_sales_lead_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sales_lead_updated_at BEFORE UPDATE ON public.sales_lead FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: target_audience trigger_target_audience_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_target_audience_updated_at BEFORE UPDATE ON public.target_audience FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feature trigger_update_feature_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_feature_search_vector BEFORE INSERT OR UPDATE ON public.feature FOR EACH ROW EXECUTE FUNCTION public.update_feature_search_vector();


--
-- Name: product trigger_update_product_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_product_search_vector BEFORE INSERT OR UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.update_product_search_vector();


--
-- Name: users trigger_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_conversations fk_chat_conversations_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT fk_chat_conversations_session FOREIGN KEY (session_id) REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE;


--
-- Name: chat_sessions fk_chat_sessions_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT fk_chat_sessions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: product fk_product_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT fk_product_category FOREIGN KEY (product_category_id) REFERENCES public.product_category(id) ON DELETE RESTRICT;


--
-- Name: item_feature item_feature_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_feature
    ADD CONSTRAINT item_feature_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_feature item_feature_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_feature
    ADD CONSTRAINT item_feature_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES public.feature(id) ON DELETE CASCADE;


--
-- Name: product_feature fk_product_feature_feature; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_feature
    ADD CONSTRAINT fk_product_feature_feature FOREIGN KEY (feature_id) REFERENCES public.feature(id) ON DELETE CASCADE;


--
-- Name: product_feature fk_product_feature_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_feature
    ADD CONSTRAINT fk_product_feature_product FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: product fk_product_target_audience; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT fk_product_target_audience FOREIGN KEY (target_audience_id) REFERENCES public.target_audience(id) ON DELETE RESTRICT;


--
-- Name: sales_lead_user_selection fk_sales_lead_user_selection_lead; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_lead_user_selection
    ADD CONSTRAINT fk_sales_lead_user_selection_lead FOREIGN KEY (sales_lead_id) REFERENCES public.sales_lead(id) ON DELETE CASCADE;


--
-- Name: sales_lead_user_selection fk_sales_lead_user_selection_selection; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_lead_user_selection
    ADD CONSTRAINT fk_sales_lead_user_selection_selection FOREIGN KEY (user_selection_id) REFERENCES public.user_selection(id) ON DELETE CASCADE;


--
-- Name: user_selection fk_user_selection_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_selection
    ADD CONSTRAINT fk_user_selection_item FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_embedding item_embedding_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_embedding
    ADD CONSTRAINT item_embedding_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item item_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item
    ADD CONSTRAINT item_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict b4zKQlzpM2hK0jZdtVoh3gw2AZKLJpiterQncW7ZN2C0fvoxjTAgynWKLgdvT0Y

