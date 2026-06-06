CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  title text NOT NULL,
  note text,
  category text,
  proposed_by integer NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  validated_by integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wishlist_items_room_code_idx ON public.wishlist_items (room_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO anon, authenticated;
GRANT ALL ON public.wishlist_items TO service_role;

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read wishlist_items" ON public.wishlist_items FOR SELECT USING (true);
CREATE POLICY "public insert wishlist_items" ON public.wishlist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "public update wishlist_items" ON public.wishlist_items FOR UPDATE USING (true);
CREATE POLICY "public delete wishlist_items" ON public.wishlist_items FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlist_items;
ALTER TABLE public.wishlist_items REPLICA IDENTITY FULL;